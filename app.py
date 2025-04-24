import os
import time
import mimetypes
import shutil
import glob
import json
import threading
import re
import concurrent.futures
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
from main import VoiceGenerator
from gradio_client import file
from audio_utils import merge_audio_with_background

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# 配置SERVER_NAME允许在线程中构建URL
app.config['SERVER_NAME'] = '127.0.0.1:5000'
app.config['APPLICATION_ROOT'] = '/'
app.config['PREFERRED_URL_SCHEME'] = 'http'

# 确保正确注册音频MIME类型
mimetypes.add_type('audio/wav', '.wav')
mimetypes.add_type('audio/mpeg', '.mp3')

# 配置上传文件保存位置
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 合成文件保存位置
MERGED_FOLDER = 'merged_audio'
if not os.path.exists(MERGED_FOLDER):
    os.makedirs(MERGED_FOLDER)

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {'lrc', 'wav', 'mp3', 'ckpt', 'pth', 'vtt'}

# 任务状态管理
task_status = {}
# 任务锁，用于多线程安全
task_lock = threading.Lock()

# 设置并发处理的线程数
MAX_WORKERS = 4  # 可以根据系统性能调整
MAX_RETRY_COUNT = 3  # 默认失败重试次数

# 任务控制字典，用于存储正在运行任务的控制信号
task_control = {}  # {job_id: {"stop": False}}

def allowed_file(filename, extensions=ALLOWED_EXTENSIONS):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in extensions

# 确保保存的文件有正确的扩展名
def get_file_extension(filename):
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''

def ensure_file_extension(filename, file_type):
    """确保文件名有正确的扩展名"""
    ext = get_file_extension(filename)
    if not ext:
        # 根据文件类型添加默认扩展名
        if file_type == 'ref_audio':
            return filename + '.wav'
        elif file_type == 'lrc':
            return filename + '.lrc'
        elif file_type == 'gpt_model':
            return filename + '.ckpt'
        elif file_type == 'sovits_model':
            return filename + '.pth'
        elif file_type == 'background_music':
            return filename + '.mp3'
    return filename

# 获取下一个音频序号
def get_next_audio_number(subfolder):
    """获取下一个可用的音频文件序号"""
    files = glob.glob(os.path.join(app.config['UPLOAD_FOLDER'], subfolder, "*.wav"))
    numbers = [0]  # 默认从1开始
    for file in files:
        try:
            num = int(os.path.basename(file).split('.')[0])
            numbers.append(num)
        except (ValueError, IndexError):
            pass
    return max(numbers) + 1

def update_task_status(job_id, status, progress=None, message=None, logs=None, result=None, error=None):
    """更新任务状态"""
    with task_lock:
        if job_id not in task_status:
            task_status[job_id] = {
                'status': 'pending',
                'progress': {'percent': 0, 'message': '准备中...', 'logs': []},
                'result': None,
                'error': None,
                'created_at': time.time(),
                'updated_at': time.time()
            }
        
        if status:
            task_status[job_id]['status'] = status
        
        if progress is not None:
            task_status[job_id]['progress']['percent'] = progress
        
        if message:
            task_status[job_id]['progress']['message'] = message
        
        if logs:
            if isinstance(logs, list):
                task_status[job_id]['progress']['logs'].extend(logs)
            else:
                task_status[job_id]['progress']['logs'].append(logs)
        
        if result:
            task_status[job_id]['result'] = result
            
        if error:
            task_status[job_id]['error'] = error
            
        task_status[job_id]['updated_at'] = time.time()
        
        # 清理过期任务（保留24小时内的任务）
        current_time = time.time()
        expired_jobs = [jid for jid, info in task_status.items() 
                       if current_time - info['updated_at'] > 86400]  # 24小时
        
        for jid in expired_jobs:
            del task_status[jid]

def add_task_log(job_id, message):
    """添加任务日志"""
    with task_lock:
        if job_id in task_status:
            if 'logs' not in task_status[job_id]['progress']:
                task_status[job_id]['progress']['logs'] = []
            
            task_status[job_id]['progress']['logs'].append(message)
            task_status[job_id]['updated_at'] = time.time()
            
            print(f"任务 {job_id} 日志: {message}")

def vtt_to_lrc(vtt_file_path, lrc_file_path=None):
    """
    将VTT字幕文件转换为LRC格式
    
    参数:
        vtt_file_path: VTT文件路径
        lrc_file_path: 可选，输出LRC文件路径，如果不提供则返回转换后的文本
        
    返回:
        如果提供lrc_file_path，则返回转换后的LRC文件路径
        否则返回转换后的LRC文本
    """
    try:
        # 读取VTT文件
        with open(vtt_file_path, 'r', encoding='utf-8') as f:
            vtt_content = f.read()
        
        # 初始化LRC内容
        lrc_lines = []
        
        # 解析VTT文件，查找时间戳和文本
        # VTT格式示例：
        # 00:00:00.845 --> 00:00:04.060
        # 啊 找到了找到了
        time_text_pattern = re.compile(r'(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\s*\n([\s\S]*?)(?=\n\s*\n|\n\d|\Z)', re.MULTILINE)
        
        matches = time_text_pattern.findall(vtt_content)
        
        for match in matches:
            hours, minutes, seconds, milliseconds, text = match
            
            # 处理文本(移除多余空白并合并多行)
            text = re.sub(r'\s+', ' ', text.strip())
            
            # 转换为LRC时间格式 [mm:ss.xx]
            # 注意: LRC格式通常不包含小时，这里将小时转换为分钟
            total_minutes = int(hours) * 60 + int(minutes)
            # 修改格式以匹配parse_lrc函数的期望: [mm:ss.xxx]
            lrc_time = f"[{total_minutes:02d}:{seconds}.{milliseconds[:3]}]"
            
            # 添加到LRC行
            lrc_lines.append(f"{lrc_time}{text}")
        
        # 合并所有行
        lrc_content = "\n".join(lrc_lines)
        
        # 如果提供了输出文件路径，将内容写入文件
        if lrc_file_path:
            with open(lrc_file_path, 'w', encoding='utf-8') as f:
                f.write(lrc_content)
            print(f"VTT转换为LRC成功: {lrc_file_path}")
            return lrc_file_path
        
        # 否则返回转换后的内容
        return lrc_content
        
    except Exception as e:
        print(f"VTT转换LRC出错: {str(e)}")
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/batch')
def batch():
    """批量处理页面"""
    return render_template('batch.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """处理文件上传"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有文件'})
    
    file = request.files['file']
    file_type = request.form.get('type', '')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'})
    
    if file:
        try:
            # 处理文件名
            if file_type == 'ref_audio':
                # 为参考音频使用序号命名
                next_number = get_next_audio_number('ref_audio')
                filename = f"{next_number}.wav"
            elif file_type == 'background_music':  # 新增背景音乐处理
                # 为背景音乐使用序号命名
                next_number = get_next_audio_number('background_music')
                ext = get_file_extension(file.filename) or 'mp3'
                filename = f"{next_number}.{ext}"
            else:
                # 其他文件使用安全的原始文件名
                original_filename = file.filename
                filename = secure_filename(original_filename)
                filename = ensure_file_extension(filename, file_type)
            
            # 检查文件扩展名
            ext = get_file_extension(filename)
            if ext not in ALLOWED_EXTENSIONS:
                return jsonify({'success': False, 'error': f'不支持的文件类型: {ext}'})
            
            # 根据文件类型创建不同的子文件夹
            subfolder = file_type if file_type else 'other'
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], subfolder)
            
            if not os.path.exists(save_path):
                os.makedirs(save_path)
                
            file_path = os.path.join(save_path, filename)
            file.save(file_path)
            
            # 如果是VTT文件，转换为LRC
            if ext == 'vtt' and file_type == 'lrc':
                # 生成LRC文件名(保留原文件名，但更改扩展名)
                lrc_filename = filename.rsplit('.', 1)[0] + '.lrc'
                lrc_path = os.path.join(save_path, lrc_filename)
                
                # 转换VTT为LRC
                lrc_path = vtt_to_lrc(file_path, lrc_path)
                
                # 更新文件路径和名称
                file_path = lrc_path
                filename = lrc_filename
                print(f"VTT文件已转换为LRC: {file_path}")
            
            # 记录日志
            print(f"文件上传成功: {file_path}")
            
            # 构建URL安全的路径
            with app.app_context():
                # 使用简单的相对路径而非url_for
                file_url = f"/uploads/{os.path.join(subfolder, filename)}"
            
            return jsonify({
                'success': True, 
                'filename': filename,
                'path': file_path,
                'url': file_url
            })
        except Exception as e:
            print(f"上传文件时出错: {str(e)}")
            return jsonify({'success': False, 'error': f'上传失败: {str(e)}'})
    
    return jsonify({'success': False, 'error': '文件上传失败'})

@app.route('/uploads/<path:filename>')
def serve_static_file(filename):
    """提供上传文件的访问"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/process', methods=['POST'])
def process_lrc():
    """处理LRC文件生成音频"""
    data = request.json
    
    server_url = data.get('server_url', 'http://127.0.0.1:9872/')
    lrc_file = data.get('lrc_file', '')
    ref_audio = data.get('ref_audio', '')
    prompt_text = data.get('prompt_text', '')
    weights_path = data.get('weights_path', 'GPT_weights/')
    sovits_path = data.get('sovits_path', 'SoVITS_weights/')
    task_id = data.get('task_id', int(time.time()))
    worker_threads = data.get('worker_threads', MAX_WORKERS)  # 使用前端传入的工作线程数
    retry_count = data.get('retry_count', MAX_RETRY_COUNT)  # 获取重试次数
    
    # 确保工作线程数为合理的整数值
    try:
        worker_threads = int(worker_threads)
        if worker_threads < 1:
            worker_threads = 1
        elif worker_threads > 32:  # 设置上限以防止资源耗尽
            worker_threads = 32
    except (ValueError, TypeError):
        worker_threads = MAX_WORKERS  # 使用默认值
    
    # 确保重试次数为合理的整数值
    try:
        retry_count = int(retry_count)
        if retry_count < 0:
            retry_count = 0
        elif retry_count > 10:  # 设置上限以防止无限重试
            retry_count = 10
    except (ValueError, TypeError):
        retry_count = MAX_RETRY_COUNT  # 使用默认值
    
    if not lrc_file or not os.path.exists(lrc_file):
        return jsonify({'success': False, 'error': 'LRC文件不存在'})
    
    if not ref_audio or not os.path.exists(ref_audio):
        return jsonify({'success': False, 'error': '参考音频文件不存在'})
    
    # 初始化任务状态
    job_id = str(task_id)
    update_task_status(job_id, 'processing', 0, '正在初始化...')
    # 初始化任务控制信号
    task_control[job_id] = {"stop": False}
    
    # 使用线程处理任务，避免阻塞请求
    def process_task():
        try:
            # 检查是否收到停止信号
            if task_control.get(job_id, {}).get("stop", False):
                update_task_status(job_id, 'stopped', None, None, None, None, "任务已手动停止")
                return
                
            update_task_status(job_id, 'processing', 5, '正在初始化模型...')
            generator = VoiceGenerator(server_url=server_url)
            
            # 自定义初始化模型
            update_task_status(job_id, 'processing', 10, '加载GPT模型...')
            generator.client.predict(
                weights_path=weights_path,
                api_name="/init_t2s_weights"
            )
            
            update_task_status(job_id, 'processing', 15, '加载SoVITS模型...')
            generator.client.predict(
                sovits_path=sovits_path,
                prompt_language="中文",
                text_language="中文",
                api_name="/change_sovits_weights"
            )
            
            # 覆盖默认的prompt_text
            update_task_status(job_id, 'processing', 20, f'开始处理LRC文件，使用 {worker_threads} 个工作线程，失败重试次数：{retry_count}...')
            result_path = process_with_custom_prompt(job_id, generator, lrc_file, ref_audio, prompt_text, worker_threads, retry_count)
            
            if not result_path:
                update_task_status(job_id, 'failed', None, None, None, None, "音频生成失败")
                return
            
            # 在应用上下文中构建URL
            with app.app_context():
                # 构建URL安全的路径
                result_filename = os.path.basename(result_path)
                # 使用简单的相对路径而非url_for，避免线程问题
                result_url = f"/wav_file/{result_filename}"
                
                # 更新任务状态为完成
                result_data = {
                    'success': True,
                    'message': '处理完成',
                    'audio_path': result_path,
                    'audio_url': result_url
                }
                
                update_task_status(job_id, 'completed', 100, '处理完成', None, result_data)
            
        except Exception as e:
            print(f"处理任务 {job_id} 出错: {str(e)}")
            update_task_status(job_id, 'failed', None, None, None, None, str(e))
    
    # 启动处理线程
    thread = threading.Thread(target=process_task)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'success': True,
        'message': '任务已提交',
        'job_id': job_id
    })

@app.route('/api/merge-audio', methods=['POST'])
def merge_audio():
    """合并人声与背景音乐"""
    data = request.json
    
    vocal_path = data.get('vocal_path', '')
    background_path = data.get('background_path', '')
    vocal_volume = float(data.get('vocal_volume', 1.0))
    bg_volume = float(data.get('bg_volume', 1.0))
    stereo_mode = data.get('stereo_mode', 'mix')
    
    if not vocal_path or not os.path.exists(vocal_path):
        return jsonify({'success': False, 'error': '人声文件不存在'})
    
    if not background_path or not os.path.exists(background_path):
        return jsonify({'success': False, 'error': '背景音乐文件不存在'})
    
    try:
        # 创建合并文件的输出文件名
        output_filename = f"merged_{int(time.time())}.wav"
        output_path = os.path.join(MERGED_FOLDER, output_filename)
        
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # 合并音频
        success = merge_audio_with_background(
            vocal_path=vocal_path,
            background_path=background_path,
            output_path=output_path,
            vocal_volume=vocal_volume,
            bg_volume=bg_volume,
            stereo_mode=stereo_mode
        )
        
        if success:
            # 构建URL安全的路径
            with app.app_context():
                # 使用简单的相对路径而非url_for
                output_url = f"/merged_audio/{output_filename}"
            
            return jsonify({
                'success': True,
                'message': '音频合并完成',
                'audio_path': output_path,
                'audio_url': output_url
            })
        else:
            return jsonify({
                'success': False,
                'error': '音频合并失败'
            })
    
    except Exception as e:
        print(f"合并音频时出错: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'合并音频失败: {str(e)}'
        })

def process_with_custom_prompt(job_id, generator, lrc_file, ref_audio_path, prompt_text, worker_threads=MAX_WORKERS, retry_count=MAX_RETRY_COUNT):
    """使用自定义提示文本处理"""
    # 打印文件路径和内容预览
    print(f"处理LRC文件: {lrc_file}, 使用 {worker_threads} 个工作线程, 失败重试次数: {retry_count}")
    try:
        with open(lrc_file, 'r', encoding='utf-8') as f:
            lrc_content = f.read(500)  # 读取前500个字符预览
            print(f"LRC文件内容预览: {lrc_content}")
    except Exception as e:
        print(f"读取LRC文件失败: {str(e)}")
    
    # 解析LRC文件
    lyrics = generator.parse_lrc(lrc_file)
    print(f"解析结果: 找到 {len(lyrics)} 条文本")
    if len(lyrics) > 0:
        print(f"第一条解析结果: {lyrics[0]}")
    
    audio_files = []
    total = len(lyrics)
    
    # 添加任务日志
    add_task_log(job_id, f"解析LRC文件，共有 {len(lyrics)} 条文本需要处理")
    add_task_log(job_id, f"使用 {worker_threads} 个工作线程进行并行处理")
    add_task_log(job_id, f"配置失败重试次数: {retry_count}")
    
    if total == 0:
        update_task_status(job_id, 'failed', None, None, None, None, "未在LRC文件中找到有效文本")
        return None
    
    # 创建线程安全的计数器和进度更新
    processed_count = 0
    process_lock = threading.Lock()
    
    # 处理单条文本的函数
    def process_text_line(item):
        nonlocal processed_count
        index, (timestamp, text) = item
        
        # 检查任务是否应该停止
        if task_control.get(job_id, {}).get("stop", False):
            add_task_log(job_id, f"任务停止，取消处理项 [{index+1}/{total}]")
            return None
            
        # 重试逻辑
        attempts = 0
        max_attempts = retry_count + 1  # 原始尝试 + 重试次数
        
        while attempts < max_attempts:
            try:
                attempts += 1
                
                if attempts > 1:
                    add_task_log(job_id, f"重试 ({attempts-1}/{retry_count}) 处理项 [{index+1}/{total}]: {text}")
                
                # 使用正确的文件引用方式 - 使用 gradio_client.file 包装
                result = generator.client.predict(
                    text=text,
                    text_lang="中文",
                    ref_audio_path=file(ref_audio_path),  # 使用file()包装音频路径
                    aux_ref_audio_paths=[],
                    prompt_text=prompt_text,
                    prompt_lang="中文",
                    api_name="/inference"
                )
                
                # 获取生成的音频文件路径并复制到输出目录
                audio_path = result[0]
                file_name = f"{int(time.time()*1000)}_{index}.wav"
                target_path = os.path.join(generator.wav_dir, file_name)
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                
                # 复制文件
                shutil.copy2(audio_path, target_path)
                
                # 更新进度（线程安全）
                with process_lock:
                    processed_count += 1
                    progress = 20 + (processed_count / total) * 60  # 总进度从20%到80%
                    message = f"已处理 [{processed_count}/{total}]"
                    update_task_status(job_id, 'processing', int(progress), message)
                    add_task_log(job_id, f"处理完成 [{index+1}/{total}]: {text}")
                
                # 返回时间戳和目标路径
                return (timestamp, target_path)
                
            except Exception as e:
                error_message = f"处理文本时出错 [{index+1}/{total}]: {text}, 错误: {str(e)}"
                print(error_message)
                
                if attempts < max_attempts:
                    add_task_log(job_id, f"处理失败，将重试 ({attempts}/{retry_count}): {error_message}")
                    time.sleep(1)  # 失败后短暂等待，避免立即重试
                else:
                    add_task_log(job_id, f"达到最大重试次数，放弃处理: {error_message}")
                    return None
    
    # 使用线程池并行处理文本
    update_task_status(job_id, 'processing', 20, f'开始并行处理LRC文件，使用 {worker_threads} 个工作线程...')
    
    # 创建索引化的任务列表
    indexed_lyrics = list(enumerate(lyrics))
    
    # 使用线程池执行，使用前端传入的工作线程数
    with concurrent.futures.ThreadPoolExecutor(max_workers=worker_threads) as executor:
        # 提交所有任务
        future_to_text = {executor.submit(process_text_line, item): item for item in indexed_lyrics}
        
        # 收集结果
        for future in concurrent.futures.as_completed(future_to_text):
            # 检查任务是否应该停止
            if task_control.get(job_id, {}).get("stop", False):
                # 取消所有未完成的任务
                for f in future_to_text:
                    if not f.done():
                        f.cancel()
                update_task_status(job_id, 'stopped', None, '任务已停止', None, None, "任务已手动停止")
                return None
                
            result = future.result()
            if result:
                audio_files.append(result)
    
    # 如果任务已被停止，返回None
    if task_control.get(job_id, {}).get("stop", False):
        update_task_status(job_id, 'stopped', None, '任务已停止', None, None, "任务已手动停止")
        return None
    
    # 过滤掉失败的结果并按时间戳排序
    audio_files = [item for item in audio_files if item is not None]
    audio_files.sort(key=lambda x: x[0])  # 按时间戳排序
    
    if not audio_files:
        update_task_status(job_id, 'failed', None, None, None, None, "没有音频文件可供拼接")
        return None
    
    # 合成最终音频
    update_task_status(job_id, 'processing', 80, '正在合成最终音频...')
    from audio_utils import combine_audio_files
    output_path = os.path.join(generator.wav_dir, f"final_audio_{int(time.time())}.wav")
    combine_audio_files(audio_files, output_path)
    
    update_task_status(job_id, 'processing', 95, '音频合成完成，准备输出...')
    add_task_log(job_id, f"最终音频已生成: {output_path}")
    
    return output_path

@app.route('/wav_file/<path:filename>')
def serve_result_audio(filename):
    """提供生成的音频文件访问"""
    return send_from_directory('wav_file', filename)

@app.route('/merged_audio/<path:filename>')
def serve_merged_audio(filename):
    """提供合并后的音频文件访问"""
    return send_from_directory(MERGED_FOLDER, filename)

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取处理状态"""
    job_id = request.args.get('job_id')
    
    if not job_id or job_id not in task_status:
        return jsonify({'status': 'not_found'})
    
    return jsonify(task_status[job_id])

@app.route('/api/preview/<path:filename>')
def serve_audio(filename):
    """提供音频文件服务"""
    try:
        directory = os.path.dirname(filename)
        filename = os.path.basename(filename)
        
        # 获取文件MIME类型
        file_path = os.path.join(directory, filename)
        if not os.path.exists(file_path):
            print(f"文件不存在: {file_path}")
            return "文件不存在", 404
            
        # 获取文件扩展名
        ext = get_file_extension(filename)
        if ext == 'wav':
            mimetype = 'audio/wav'
        elif ext == 'mp3':
            mimetype = 'audio/mpeg'
        else:
            mimetype = None
            
        print(f"提供文件: {file_path}, MIME类型: {mimetype}")
        
        # 使用正确的MIME类型提供文件
        return send_from_directory(
            directory, 
            filename, 
            mimetype=mimetype,
            as_attachment=False
        )
    except Exception as e:
        print(f"提供文件时发生错误: {str(e)}")
        return str(e), 500

@app.route('/api/download/<path:filename>')
def download_file(filename):
    """下载文件"""
    try:
        directory = os.path.dirname(filename)
        filename = os.path.basename(filename)
        return send_from_directory(directory, filename, as_attachment=True)
    except Exception as e:
        print(f"下载文件时发生错误: {str(e)}")
        return str(e), 500

@app.route('/api/clean-cache', methods=['POST'])
def clean_cache():
    """清理缓存文件"""
    try:
        # 递归清理uploads目录下的所有文件，但保留文件夹结构
        def clean_directory(directory):
            if os.path.exists(directory):
                for item in os.listdir(directory):
                    item_path = os.path.join(directory, item)
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                        print(f"已删除文件: {item_path}")
                    elif os.path.isdir(item_path):
                        clean_directory(item_path)
        
        # 清理uploads目录
        clean_directory(app.config['UPLOAD_FOLDER'])
        
        # 清理wav_file目录
        wav_file_path = 'wav_file'
        if os.path.exists(wav_file_path):
            for file in os.listdir(wav_file_path):
                file_path = os.path.join(wav_file_path, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"已删除文件: {file_path}")
        
        # 清理merged_audio目录
        if os.path.exists(MERGED_FOLDER):
            for file in os.listdir(MERGED_FOLDER):
                file_path = os.path.join(MERGED_FOLDER, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"已删除文件: {file_path}")
        
        # 清理任务状态
        with task_lock:
            task_status.clear()
                    
        return jsonify({
            'success': True, 
            'message': '缓存清理完成'
        })
    except Exception as e:
        print(f"清理缓存时出错: {str(e)}")
        return jsonify({
            'success': False, 
            'error': f'清理缓存失败: {str(e)}'
        })

@app.route('/api/stop-task', methods=['POST'])
def stop_task():
    """停止正在进行的任务"""
    data = request.json
    job_id = data.get('job_id')
    
    if not job_id or job_id not in task_status:
        return jsonify({'success': False, 'error': '任务不存在'})
    
    # 设置停止信号
    if job_id in task_control:
        task_control[job_id]["stop"] = True
        add_task_log(job_id, "收到停止信号，正在尝试停止任务...")
        update_task_status(job_id, 'stopping', None, '正在停止任务...')
    
    return jsonify({
        'success': True,
        'message': '已发送停止信号'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 