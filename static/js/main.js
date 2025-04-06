// 全局变量
let lrcFilePath = null;
let refAudioPath = null;
let refAudioUrl = null;
let bgMusicPath = null;
let bgMusicUrl = null;
let resultAudioPath = null;
let resultAudioUrl = null;
let mergedAudioPath = null;
let mergedAudioUrl = null;
let taskId = null; // 任务ID

// DOM 元素引用
const apiServerInput = document.getElementById('apiServer');
const gptPathInput = document.getElementById('gptPath');
const sovitsPathInput = document.getElementById('sovitsPath');
const refTextInput = document.getElementById('refText');
const lrcFileInput = document.getElementById('lrcFile');
const refAudioInput = document.getElementById('refAudio');
const uploadLrcBtn = document.getElementById('uploadLrcBtn');
const uploadRefAudioBtn = document.getElementById('uploadRefAudioBtn');
const processBtn = document.getElementById('processBtn');
const cleanCacheBtn = document.getElementById('cleanCacheBtn');
const processingInfo = document.getElementById('processingInfo');
const resultArea = document.getElementById('resultArea');
const resultAudio = document.getElementById('resultAudio');
const downloadBtn = document.getElementById('downloadBtn');
const lrcFileInfo = document.getElementById('lrcFileInfo');
const refAudioInfo = document.getElementById('refAudioInfo');
const refAudioPlayer = document.getElementById('refAudioPlayer');
const workerThreadsSelect = document.getElementById('workerThreads');
const customWorkerThreadsInput = document.getElementById('customWorkerThreads');

// 进度和日志相关元素
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressStatus = document.getElementById('progressStatus');
const logContainer = document.getElementById('logContainer');
const logOutput = document.getElementById('logOutput');
const clearLogBtn = document.getElementById('clearLogBtn');

// 背景音乐相关元素
const bgMusicInput = document.getElementById('backgroundMusic');
const uploadBgMusicBtn = document.getElementById('uploadBgMusicBtn');
const bgMusicInfo = document.getElementById('bgMusicInfo');
const bgMusicPlayer = document.getElementById('bgMusicPlayer');
const mergeAudioSection = document.getElementById('mergeAudioSection');
const vocalVolume = document.getElementById('vocalVolume');
const bgVolume = document.getElementById('bgVolume');
const vocalVolumeValue = document.getElementById('vocalVolumeValue');
const bgVolumeValue = document.getElementById('bgVolumeValue');
const mergeAudioBtn = document.getElementById('mergeAudioBtn');
const mergedResultArea = document.getElementById('mergedResultArea');
const mergedAudio = document.getElementById('mergedAudio');
const downloadMergedBtn = document.getElementById('downloadMergedBtn');

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 上传LRC文件
    uploadLrcBtn.addEventListener('click', () => uploadFile(lrcFileInput, 'lrc', lrcFileInfo));
    
    // 上传参考音频
    uploadRefAudioBtn.addEventListener('click', () => uploadFile(refAudioInput, 'ref_audio', refAudioInfo, refAudioPlayer));
    
    // 上传背景音乐
    uploadBgMusicBtn.addEventListener('click', () => uploadFile(bgMusicInput, 'background_music', bgMusicInfo, bgMusicPlayer));
    
    // 处理LRC文件生成音频
    processBtn.addEventListener('click', processLrc);
    
    // 下载生成的音频
    downloadBtn.addEventListener('click', () => {
        if (resultAudioPath) {
            downloadFile(resultAudioPath);
        }
    });
    
    // 下载合成的音频
    downloadMergedBtn.addEventListener('click', () => {
        if (mergedAudioPath) {
            downloadFile(mergedAudioPath);
        }
    });
    
    // 清理缓存
    cleanCacheBtn.addEventListener('click', cleanCache);
    
    // 清空日志
    clearLogBtn.addEventListener('click', clearLog);
    
    // 音量调节实时更新显示值
    vocalVolume.addEventListener('input', () => {
        vocalVolumeValue.textContent = vocalVolume.value;
    });
    
    bgVolume.addEventListener('input', () => {
        bgVolumeValue.textContent = bgVolume.value;
    });
    
    // 合成音频
    mergeAudioBtn.addEventListener('click', mergeAudio);
    
    // 工作线程数自定义选项
    workerThreadsSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customWorkerThreadsInput.style.display = 'block';
            customWorkerThreadsInput.focus();
        } else {
            customWorkerThreadsInput.style.display = 'none';
        }
    });
});

/**
 * 添加日志信息
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型 (info, success, error, warning)
 */
function addLog(message, type = 'info') {
    // 显示日志容器
    logContainer.style.display = 'block';
    
    // 创建日志条目
    const logEntry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    // 设置日志样式
    logEntry.className = `log-entry log-${type}`;
    
    // 设置日志内容
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    
    // 添加到日志输出区域
    logOutput.appendChild(logEntry);
    
    // 滚动到最新日志
    logOutput.scrollTop = logOutput.scrollHeight;
    
    // 同时输出到控制台
    console.log(`[${timestamp}] ${message}`);
}

/**
 * 清空日志
 */
function clearLog() {
    logOutput.innerHTML = '';
    addLog('日志已清空');
}

/**
 * 更新进度
 * @param {number} percent - 进度百分比 (0-100)
 * @param {string} status - 进度状态文本
 */
function updateProgress(percent, status) {
    // 显示进度容器
    progressContainer.style.display = 'block';
    
    // 设置进度条
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    
    // 设置状态文本
    if (status) {
        progressStatus.textContent = status;
    }
    
    // 添加日志
    addLog(`进度: ${percent}%, ${status}`);
}

/**
 * 重置进度
 */
function resetProgress() {
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressStatus.textContent = '准备中...';
}

/**
 * 上传文件
 * @param {HTMLInputElement} fileInput - 文件输入元素
 * @param {string} fileType - 文件类型
 * @param {HTMLElement} infoElement - 显示信息的元素
 * @param {HTMLAudioElement} audioPlayer - 音频播放器元素(可选)
 */
async function uploadFile(fileInput, fileType, infoElement, audioPlayer = null) {
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('请先选择文件');
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', fileType);
    
    try {
        infoElement.innerHTML = '上传中...';
        infoElement.classList.add('text-info');
        
        // 检查是否是VTT文件
        const isVtt = file.name.toLowerCase().endsWith('.vtt');
        if (isVtt && fileType === 'lrc') {
            addLog(`检测到VTT字幕文件，将自动转换为LRC格式`, 'info');
        }
        
        addLog(`开始上传${fileType}文件: ${file.name}`, 'info');
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (isVtt && fileType === 'lrc') {
                infoElement.innerHTML = `已上传并转换: ${result.filename}`;
                addLog(`VTT文件已成功转换为LRC: ${result.filename}`, 'success');
                addLog(`更新文件路径: 从${file.name}到${result.filename}`, 'info');
            } else {
                infoElement.innerHTML = `已上传: ${result.filename}`;
                addLog(`${fileType}文件上传成功: ${result.filename}`, 'success');
            }
            
            infoElement.classList.remove('text-info', 'text-danger');
            infoElement.classList.add('text-success');
            
            // 根据文件类型保存路径或URL
            if (fileType === 'lrc') {
                lrcFilePath = result.path;
                addLog(`LRC文件路径已保存: ${lrcFilePath}`, 'info');
            } else if (fileType === 'ref_audio') {
                refAudioPath = result.path;
                refAudioUrl = result.url;
                
                // 显示音频播放器
                if (audioPlayer) {
                    audioPlayer.src = refAudioUrl;
                    audioPlayer.style.display = 'block';
                }
            } else if (fileType === 'background_music') {
                bgMusicPath = result.path;
                bgMusicUrl = result.url;
                
                // 显示音频播放器
                if (audioPlayer) {
                    audioPlayer.src = bgMusicUrl;
                    audioPlayer.style.display = 'block';
                }
            }
        } else {
            infoElement.innerHTML = `上传失败: ${result.error}`;
            infoElement.classList.remove('text-info', 'text-success');
            infoElement.classList.add('text-danger');
            
            addLog(`${fileType}文件上传失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('上传文件时出错:', error);
        infoElement.innerHTML = `上传错误: ${error.message}`;
        infoElement.classList.remove('text-info', 'text-success');
        infoElement.classList.add('text-danger');
        
        addLog(`上传出错: ${error.message}`, 'error');
    }
}

/**
 * 获取工作线程数
 * @returns {number} 工作线程数
 */
function getWorkerThreads() {
    if (workerThreadsSelect.value === 'custom' && customWorkerThreadsInput.value) {
        const customValue = parseInt(customWorkerThreadsInput.value);
        if (!isNaN(customValue) && customValue > 0) {
            return customValue;
        }
    }
    return parseInt(workerThreadsSelect.value) || 4; // 默认4线程
}

/**
 * 处理LRC文件生成音频
 */
async function processLrc() {
    if (!lrcFilePath || !refAudioPath) {
        alert('请先上传LRC文件和参考音频');
        return;
    }
    
    // 确认文件路径正确，并且应该是.lrc文件
    if (!lrcFilePath.toLowerCase().endsWith('.lrc')) {
        addLog(`警告: LRC文件路径不是以.lrc结尾: ${lrcFilePath}`, 'warning');
        // 如果是.vtt文件，尝试修正路径
        if (lrcFilePath.toLowerCase().endsWith('.vtt')) {
            const correctedPath = lrcFilePath.slice(0, -4) + '.lrc';
            addLog(`尝试使用转换后的LRC文件路径: ${correctedPath}`, 'info');
            lrcFilePath = correctedPath;
        }
    }
    
    // 获取配置值
    const serverUrl = apiServerInput.value.trim();
    const promptText = refTextInput.value.trim();
    const weightsPath = gptPathInput.value.trim();
    const sovitsPath = sovitsPathInput.value.trim();
    const workerThreads = getWorkerThreads();
    
    // 显示处理状态
    processingInfo.style.display = 'block';
    progressContainer.style.display = 'block';
    logContainer.style.display = 'block';
    resultArea.style.display = 'none';
    
    // 重置进度
    resetProgress();
    
    // 生成任务ID
    taskId = Date.now();
    
    try {
        addLog('开始处理LRC文件生成音频', 'info');
        addLog(`服务器地址: ${serverUrl}`, 'info');
        addLog(`GPT模型路径: ${weightsPath}`, 'info');
        addLog(`SoVITS模型路径: ${sovitsPath}`, 'info');
        addLog(`工作线程数: ${workerThreads}`, 'info');
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server_url: serverUrl,
                lrc_file: lrcFilePath,
                ref_audio: refAudioPath,
                prompt_text: promptText,
                weights_path: weightsPath,
                sovits_path: sovitsPath,
                task_id: taskId,
                worker_threads: workerThreads
            })
        });
        
        const result = await response.json();
        
        // 开始查询进度
        if (result.success) {
            pollProgress(result.job_id);
        } else {
            // 隐藏处理状态，显示错误
            processingInfo.style.display = 'none';
            addLog(`处理失败: ${result.error}`, 'error');
            alert(`处理失败: ${result.error}`);
        }
    } catch (error) {
        console.error('处理LRC文件时出错:', error);
        processingInfo.style.display = 'none';
        addLog(`处理错误: ${error.message}`, 'error');
        alert(`处理错误: ${error.message}`);
    }
}

/**
 * 轮询任务进度
 * @param {string} jobId - 任务ID
 */
async function pollProgress(jobId) {
    try {
        const response = await fetch(`/api/status?job_id=${jobId}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
            // 处理完成
            processingInfo.style.display = 'none';
            progressContainer.style.display = 'none';
            
            // 更新最终进度
            updateProgress(100, '处理完成');
            
            // 获取结果
            if (data.result && data.result.success) {
                resultAudioPath = data.result.audio_path;
                resultAudioUrl = data.result.audio_url;
                
                // 显示结果区域
                resultArea.style.display = 'block';
                
                // 设置音频播放器
                resultAudio.src = resultAudioUrl;
                
                // 如果已上传背景音乐，显示音频合并部分
                if (bgMusicPath) {
                    mergeAudioSection.style.display = 'block';
                } else {
                    mergeAudioSection.style.display = 'none';
                }
                
                addLog('音频生成成功!', 'success');
            } else {
                addLog('处理完成，但获取结果失败', 'warning');
            }
        } else if (data.status === 'failed') {
            // 处理失败
            processingInfo.style.display = 'none';
            progressContainer.style.display = 'none';
            
            addLog(`处理失败: ${data.error || '未知错误'}`, 'error');
            alert(`处理失败: ${data.error || '未知错误'}`);
        } else {
            // 更新进度
            if (data.progress) {
                updateProgress(data.progress.percent, data.progress.message);
                
                // 如果有日志，添加到日志区域
                if (data.progress.logs && data.progress.logs.length > 0) {
                    data.progress.logs.forEach(log => {
                        addLog(log, 'info');
                    });
                }
            }
            
            // 继续轮询
            setTimeout(() => pollProgress(jobId), 1000);
        }
    } catch (error) {
        console.error('查询进度时出错:', error);
        addLog(`查询进度错误: ${error.message}`, 'error');
        
        // 出错后继续尝试
        setTimeout(() => pollProgress(jobId), 2000);
    }
}

/**
 * 合并音频和背景音乐
 */
async function mergeAudio() {
    if (!resultAudioPath || !bgMusicPath) {
        alert('需要生成的人声音频和背景音乐');
        return;
    }
    
    // 获取音量和声道模式设置
    const vocalVol = parseFloat(vocalVolume.value);
    const bgVol = parseFloat(bgVolume.value);
    const stereoMode = document.querySelector('input[name="stereoMode"]:checked').value;
    
    try {
        // 显示处理状态
        processingInfo.style.display = 'block';
        mergedResultArea.style.display = 'none';
        
        addLog('开始合并人声和背景音乐', 'info');
        addLog(`人声音量: ${vocalVol}, 背景音量: ${bgVol}, 声道模式: ${stereoMode}`, 'info');
        
        const response = await fetch('/api/merge-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vocal_path: resultAudioPath,
                background_path: bgMusicPath,
                vocal_volume: vocalVol,
                bg_volume: bgVol,
                stereo_mode: stereoMode
            })
        });
        
        const result = await response.json();
        
        // 隐藏处理状态
        processingInfo.style.display = 'none';
        
        if (result.success) {
            // 保存合并音频路径和URL
            mergedAudioPath = result.audio_path;
            mergedAudioUrl = result.audio_url;
            
            // 显示合并结果区域
            mergedResultArea.style.display = 'block';
            
            // 设置音频播放器
            mergedAudio.src = mergedAudioUrl;
            
            addLog('音频合并成功!', 'success');
        } else {
            addLog(`音频合并失败: ${result.error}`, 'error');
            alert(`音频合并失败: ${result.error}`);
        }
    } catch (error) {
        console.error('合并音频时出错:', error);
        processingInfo.style.display = 'none';
        addLog(`合并错误: ${error.message}`, 'error');
        alert(`合并错误: ${error.message}`);
    }
}

/**
 * 下载文件
 * @param {string} filePath - 文件路径
 */
function downloadFile(filePath) {
    // 创建下载链接
    const downloadUrl = `/api/download/${filePath}`;
    
    addLog(`开始下载文件: ${filePath}`, 'info');
    
    // 创建临时链接并点击
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * 清理缓存
 */
async function cleanCache() {
    try {
        addLog('开始清理缓存...', 'info');
        
        const response = await fetch('/api/clean-cache', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 重置所有状态
            lrcFilePath = null;
            refAudioPath = null;
            refAudioUrl = null;
            bgMusicPath = null;
            bgMusicUrl = null;
            resultAudioPath = null;
            resultAudioUrl = null;
            mergedAudioPath = null;
            mergedAudioUrl = null;
            
            // 清除文件信息
            lrcFileInfo.innerHTML = '';
            refAudioInfo.innerHTML = '';
            bgMusicInfo.innerHTML = '';
            
            // 重置文件输入
            lrcFileInput.value = '';
            refAudioInput.value = '';
            bgMusicInput.value = '';
            
            // 隐藏音频播放器
            refAudioPlayer.style.display = 'none';
            bgMusicPlayer.style.display = 'none';
            
            // 隐藏结果区域
            resultArea.style.display = 'none';
            mergeAudioSection.style.display = 'none';
            mergedResultArea.style.display = 'none';
            
            // 重置进度
            resetProgress();
            
            addLog('缓存清理完成', 'success');
            alert('缓存已清理');
        } else {
            addLog(`缓存清理失败: ${result.error}`, 'error');
            alert(`清理缓存失败: ${result.error}`);
        }
    } catch (error) {
        console.error('清理缓存时出错:', error);
        addLog(`清理缓存错误: ${error.message}`, 'error');
        alert(`清理缓存错误: ${error.message}`);
    }
} 