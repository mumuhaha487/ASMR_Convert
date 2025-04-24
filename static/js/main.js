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
let isProcessing = false; // 是否正在处理任务

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
const stopTaskBtn = document.getElementById('stopTaskBtn');
const processingInfo = document.getElementById('processingInfo');
const resultArea = document.getElementById('resultArea');
const resultAudio = document.getElementById('resultAudio');
const downloadBtn = document.getElementById('downloadBtn');
const lrcFileInfo = document.getElementById('lrcFileInfo');
const refAudioInfo = document.getElementById('refAudioInfo');
const refAudioPlayer = document.getElementById('refAudioPlayer');
const workerThreadsSelect = document.getElementById('workerThreads');
const customWorkerThreadsInput = document.getElementById('customWorkerThreads');
const retryCountSelect = document.getElementById('retryCount');
const customRetryCountInput = document.getElementById('customRetryCount');

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
    
    // 重试次数自定义选项
    retryCountSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customRetryCountInput.style.display = 'block';
            customRetryCountInput.focus();
        } else {
            customRetryCountInput.style.display = 'none';
        }
    });
    
    // 停止任务
    stopTaskBtn.addEventListener('click', stopTask);
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
 * @param {boolean} addLogEntry - 是否添加日志条目
 */
function updateProgress(percent, status, addLogEntry = true) {
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
    if (addLogEntry) {
        addLog(`进度: ${percent}%, ${status}`);
    }
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
 * 获取重试次数
 * @returns {number} 重试次数
 */
function getRetryCount() {
    if (retryCountSelect.value === 'custom' && customRetryCountInput.value) {
        const customValue = parseInt(customRetryCountInput.value);
        if (!isNaN(customValue) && customValue >= 0) {
            return customValue;
        }
    }
    return parseInt(retryCountSelect.value) || 3; // 默认3次重试
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
    if (!lrcFilePath) {
        alert('请先上传LRC文件');
        return;
    }
    
    if (!refAudioPath) {
        alert('请先上传参考音频');
        return;
    }
    
    try {
        // 设置状态为处理中
        isProcessing = true;
        
        // 显示处理信息
        processingInfo.style.display = 'block';
        
        // 隐藏结果区域
        resultArea.style.display = 'none';
        
        // 重置进度
        resetProgress();
        
        // 显示停止按钮
        stopTaskBtn.style.display = 'inline-block';
        
        // 禁用处理按钮
        processBtn.disabled = true;
        
        // 获取参数
        const apiServer = apiServerInput.value.trim();
        const gptPath = gptPathInput.value.trim();
        const sovitsPath = sovitsPathInput.value.trim();
        const promptText = refTextInput.value.trim();
        const workerThreads = getWorkerThreads();
        const retryCount = getRetryCount();
        
        taskId = Date.now(); // 生成唯一任务ID
        
        addLog(`开始处理LRC文件: ${lrcFilePath}`, 'info');
        addLog(`参考音频: ${refAudioPath}`, 'info');
        addLog(`API服务器: ${apiServer}`, 'info');
        addLog(`GPT模型路径: ${gptPath}`, 'info');
        addLog(`SoVITS模型路径: ${sovitsPath}`, 'info');
        addLog(`参考文本: ${promptText || '(无)'}`, 'info');
        addLog(`工作线程数: ${workerThreads}`, 'info');
        addLog(`失败重试次数: ${retryCount}`, 'info');
        
        // 提交处理请求
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server_url: apiServer,
                lrc_file: lrcFilePath,
                ref_audio: refAudioPath,
                prompt_text: promptText,
                weights_path: gptPath,
                sovits_path: sovitsPath,
                task_id: taskId,
                worker_threads: workerThreads,
                retry_count: retryCount
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 开始轮询进度
            pollProgress(result.job_id);
        } else {
            throw new Error(result.error || '提交任务失败');
        }
    } catch (error) {
        isProcessing = false;
        processingInfo.style.display = 'none';
        stopTaskBtn.style.display = 'none';
        processBtn.disabled = false;
        
        addLog(`处理出错: ${error.message}`, 'error');
        alert(`处理失败: ${error.message}`);
    }
}

/**
 * 轮询处理进度
 * @param {string} jobId - 任务ID
 */
async function pollProgress(jobId) {
    let isFailed = false;
    let isCompleted = false;
    let isStopped = false;
    
    // 保存上次的进度，用于比较变化
    let lastPercent = 0;
    let lastMessage = '';
    
    const checkProgress = async () => {
        try {
            const response = await fetch(`/api/status?job_id=${jobId}`);
            const status = await response.json();
            
            if (status.status === 'not_found') {
                throw new Error('任务不存在');
            }
            
            // 更新进度，只在发生变化时添加日志
            if (status.progress && status.progress.percent !== undefined) {
                const currentPercent = status.progress.percent;
                const currentMessage = status.progress.message || '';
                
                // 只有当进度百分比或消息发生变化时才添加日志
                const hasChanged = currentPercent !== lastPercent || currentMessage !== lastMessage;
                updateProgress(currentPercent, currentMessage, hasChanged);
                
                // 更新上次值
                lastPercent = currentPercent;
                lastMessage = currentMessage;
            }
            
            // 显示日志
            if (status.progress && status.progress.logs && status.progress.logs.length > 0) {
                // 获取上次显示的日志长度，避免重复显示
                const currentLogCount = document.querySelectorAll('#logOutput .log-entry').length;
                
                // 如果有新日志，则显示
                if (status.progress.logs.length > currentLogCount) {
                    for (let i = currentLogCount; i < status.progress.logs.length; i++) {
                        addLog(status.progress.logs[i], 'info');
                    }
                }
            }
            
            // 处理完成
            if (status.status === 'completed') {
                isCompleted = true;
                
                // 显示结果
                if (status.result && status.result.audio_url) {
                    resultAudioPath = status.result.audio_path;
                    resultAudioUrl = status.result.audio_url;
                    
                    resultAudio.src = resultAudioUrl;
                    resultArea.style.display = 'block';
                    
                    // 如果有背景音乐，显示合成区域
                    if (bgMusicPath) {
                        mergeAudioSection.style.display = 'block';
                    }
                    
                    addLog('处理完成', 'success');
                } else {
                    addLog('处理完成，但未返回音频路径', 'warning');
                }
            }
            // 处理失败
            else if (status.status === 'failed') {
                isFailed = true;
                addLog(`处理失败: ${status.error || '未知错误'}`, 'error');
                alert(`处理失败: ${status.error || '未知错误'}`);
            }
            // 处理被停止
            else if (status.status === 'stopped' || status.status === 'stopping') {
                isStopped = true;
                addLog(`任务已停止: ${status.error || '用户手动停止'}`, 'warning');
            }
            
        } catch (error) {
            console.error('轮询进度出错:', error);
            addLog(`轮询进度出错: ${error.message}`, 'error');
        }
        
        // 如果处理完成、失败或停止，则不再轮询
        if (isCompleted || isFailed || isStopped) {
            // 重置界面状态
            isProcessing = false;
            processingInfo.style.display = 'none';
            stopTaskBtn.style.display = 'none';
            processBtn.disabled = false;
            // 清除任务ID，避免再次点击停止按钮时出现"任务不存在"错误
            taskId = null;
            return;
        }
        
        // 每秒轮询一次
        setTimeout(checkProgress, 1000);
    };
    
    // 开始轮询
    checkProgress();
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

/**
 * 停止当前处理任务
 */
async function stopTask() {
    if (!taskId) {
        addLog('没有正在进行的任务', 'warning');
        return;
    }
    
    try {
        addLog('正在尝试停止任务...', 'warning');
        
        // 先禁用停止按钮，防止重复点击
        stopTaskBtn.disabled = true;
        stopTaskBtn.textContent = '正在停止...';
        
        const response = await fetch('/api/stop-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: taskId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLog('已发送停止任务信号', 'success');
        } else {
            // 如果返回任务不存在，不显示为错误，而是通知用户
            if (result.error === '任务不存在') {
                addLog('任务可能已完成或不存在，无需停止', 'info');
                // 重置任务状态
                isProcessing = false;
                processingInfo.style.display = 'none';
                stopTaskBtn.style.display = 'none';
                processBtn.disabled = false;
                taskId = null;
            } else {
                throw new Error(result.error || '停止任务失败');
            }
        }
    } catch (error) {
        addLog(`停止任务出错: ${error.message}`, 'error');
        // 恢复按钮状态
        stopTaskBtn.disabled = false;
        stopTaskBtn.textContent = '停止任务';
    }
} 