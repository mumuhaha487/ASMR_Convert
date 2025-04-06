// 全局变量
let batchRefAudioPath = null;
let batchRefAudioUrl = null;
let filePairs = []; // 存储文件对
let activeTasks = {}; // 活动任务跟踪

// DOM 元素引用
const batchApiServerInput = document.getElementById('batchApiServer');
const batchGptPathInput = document.getElementById('batchGptPath');
const batchSovitsPathInput = document.getElementById('batchSovitsPath');
const batchRefTextInput = document.getElementById('batchRefText');
const batchRefAudioInput = document.getElementById('batchRefAudio');
const batchUploadRefAudioBtn = document.getElementById('batchUploadRefAudioBtn');
const batchRefAudioInfo = document.getElementById('batchRefAudioInfo');
const batchRefAudioPlayer = document.getElementById('batchRefAudioPlayer');
const batchWorkerThreadsSelect = document.getElementById('batchWorkerThreads');
const customBatchWorkerThreadsInput = document.getElementById('customBatchWorkerThreads');
const batchMaxParallelTasksSelect = document.getElementById('batchMaxParallelTasks');
const customBatchMaxParallelTasksInput = document.getElementById('customBatchMaxParallelTasks');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFilesBtn = document.getElementById('selectFilesBtn');
const filePairsContainer = document.getElementById('filePairs');
const startBatchBtn = document.getElementById('startBatchBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const batchTasksContainer = document.getElementById('batchTasksContainer');
const noTasksMsg = document.getElementById('noTasksMsg');
const batchLogOutput = document.getElementById('batchLogOutput');
const batchClearLogBtn = document.getElementById('batchClearLogBtn');

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 上传参考音频
    batchUploadRefAudioBtn.addEventListener('click', () => uploadRefAudio());
    
    // 文件选择按钮
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    
    // 文件选择变化
    fileInput.addEventListener('change', handleFileSelection);
    
    // 拖放相关事件
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#007bff';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ccc';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    // 开始批量处理
    startBatchBtn.addEventListener('click', startBatchProcessing);
    
    // 清空文件
    clearFilesBtn.addEventListener('click', clearFiles);
    
    // 清空日志
    batchClearLogBtn.addEventListener('click', clearBatchLog);
    
    // 工作线程数自定义选项
    batchWorkerThreadsSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customBatchWorkerThreadsInput.style.display = 'block';
            customBatchWorkerThreadsInput.focus();
        } else {
            customBatchWorkerThreadsInput.style.display = 'none';
        }
    });
    
    // 最大并行任务数自定义选项
    batchMaxParallelTasksSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customBatchMaxParallelTasksInput.style.display = 'block';
            customBatchMaxParallelTasksInput.focus();
        } else {
            customBatchMaxParallelTasksInput.style.display = 'none';
        }
    });
});

/**
 * 获取工作线程数
 * @returns {number} 工作线程数
 */
function getBatchWorkerThreads() {
    if (batchWorkerThreadsSelect.value === 'custom' && customBatchWorkerThreadsInput.value) {
        const customValue = parseInt(customBatchWorkerThreadsInput.value);
        if (!isNaN(customValue) && customValue > 0) {
            return customValue;
        }
    }
    return parseInt(batchWorkerThreadsSelect.value) || 4; // 默认4线程
}

/**
 * 获取最大并行任务数
 * @returns {number} 最大并行任务数
 */
function getBatchMaxParallelTasks() {
    if (batchMaxParallelTasksSelect.value === 'custom' && customBatchMaxParallelTasksInput.value) {
        const customValue = parseInt(customBatchMaxParallelTasksInput.value);
        if (!isNaN(customValue) && customValue > 0) {
            return customValue;
        }
    }
    return parseInt(batchMaxParallelTasksSelect.value) || 3; // 默认3任务
}

/**
 * 上传参考音频
 */
async function uploadRefAudio() {
    if (!batchRefAudioInput.files || batchRefAudioInput.files.length === 0) {
        alert('请先选择参考音频文件');
        return;
    }
    
    const file = batchRefAudioInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'ref_audio');
    
    try {
        batchRefAudioInfo.innerHTML = '上传中...';
        batchRefAudioInfo.classList.add('text-info');
        
        addBatchLog(`开始上传参考音频文件: ${file.name}`, 'info');
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            batchRefAudioInfo.innerHTML = `已上传: ${result.filename}`;
            batchRefAudioInfo.classList.remove('text-info', 'text-danger');
            batchRefAudioInfo.classList.add('text-success');
            
            batchRefAudioPath = result.path;
            batchRefAudioUrl = result.url;
            
            // 显示音频播放器
            batchRefAudioPlayer.src = batchRefAudioUrl;
            batchRefAudioPlayer.style.display = 'block';
            
            addBatchLog(`参考音频文件上传成功: ${result.filename}`, 'success');
        } else {
            batchRefAudioInfo.innerHTML = `上传失败: ${result.error}`;
            batchRefAudioInfo.classList.remove('text-info', 'text-success');
            batchRefAudioInfo.classList.add('text-danger');
            
            addBatchLog(`参考音频文件上传失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('上传文件时出错:', error);
        batchRefAudioInfo.innerHTML = `上传错误: ${error.message}`;
        batchRefAudioInfo.classList.remove('text-info', 'text-success');
        batchRefAudioInfo.classList.add('text-danger');
        
        addBatchLog(`上传出错: ${error.message}`, 'error');
    }
}

/**
 * 处理选择的文件
 */
function handleFileSelection(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

/**
 * 处理文件并构建文件对
 * @param {FileList} files - 文件列表
 */
function handleFiles(files) {
    // 转换FileList为数组
    const fileArray = Array.from(files);
    
    // 分类文件
    const audioFiles = [];
    const subtitleFiles = [];
    
    fileArray.forEach(file => {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) {
            audioFiles.push(file);
        } else if (fileName.endsWith('.lrc') || fileName.endsWith('.vtt')) {
            subtitleFiles.push(file);
        }
    });
    
    addBatchLog(`检测到 ${audioFiles.length} 个音频文件和 ${subtitleFiles.length} 个字幕文件`, 'info');
    
    // 尝试配对文件
    let newPairsFound = false;
    
    // 首先尝试精确匹配，如 "music.wav" 和 "music.wav.lrc"
    audioFiles.forEach(audioFile => {
        const audioFileName = audioFile.name;
        
        // 寻找以音频文件名开头的字幕文件
        const matchedSubtitle = subtitleFiles.find(subtitleFile => 
            subtitleFile.name.startsWith(audioFileName + '.') ||
            subtitleFile.name.toLowerCase() === audioFileName.toLowerCase().replace(/\.(wav|mp3)$/, '.lrc') ||
            subtitleFile.name.toLowerCase() === audioFileName.toLowerCase().replace(/\.(wav|mp3)$/, '.vtt')
        );
        
        if (matchedSubtitle) {
            // 检查是否已经有相同文件名的配对
            const alreadyExists = filePairs.some(
                pair => pair.audioFile.name === audioFile.name && pair.subtitleFile.name === matchedSubtitle.name
            );
            
            if (!alreadyExists) {
                filePairs.push({
                    audioFile: audioFile,
                    subtitleFile: matchedSubtitle,
                    status: 'waiting',
                    audioPath: null,
                    subtitlePath: null,
                    resultPath: null,
                    mergedPath: null
                });
                newPairsFound = true;
                addBatchLog(`配对成功: ${audioFile.name} 和 ${matchedSubtitle.name}`, 'success');
            }
        }
    });
    
    // 更新UI
    if (newPairsFound) {
        updateFilePairsUI();
        startBatchBtn.disabled = false;
        clearFilesBtn.disabled = false;
    }
}

/**
 * 更新文件对UI
 */
function updateFilePairsUI() {
    filePairsContainer.innerHTML = '';
    
    if (filePairs.length === 0) {
        filePairsContainer.innerHTML = '<div class="text-muted">没有识别到文件对</div>';
        startBatchBtn.disabled = true;
        clearFilesBtn.disabled = true;
        return;
    }
    
    filePairs.forEach((pair, index) => {
        const pairElement = document.createElement('div');
        pairElement.className = 'file-pair';
        pairElement.innerHTML = `
            <div class="file-name">
                <strong>${index + 1}.</strong> 
                音频: ${pair.audioFile.name} | 
                字幕: ${pair.subtitleFile.name}
            </div>
            <span class="remove-pair" data-index="${index}">×</span>
        `;
        
        filePairsContainer.appendChild(pairElement);
        
        // 添加移除事件
        pairElement.querySelector('.remove-pair').addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            filePairs.splice(idx, 1);
            updateFilePairsUI();
        });
    });
}

/**
 * 开始批量处理
 */
async function startBatchProcessing() {
    if (filePairs.length === 0) {
        alert('没有文件可处理');
        return;
    }
    
    if (!batchRefAudioPath) {
        alert('请先上传参考音频');
        return;
    }
    
    noTasksMsg.style.display = 'none';
    
    // 获取配置值
    const serverUrl = batchApiServerInput.value.trim();
    const promptText = batchRefTextInput.value.trim();
    const weightsPath = batchGptPathInput.value.trim();
    const sovitsPath = batchSovitsPathInput.value.trim();
    const workerThreads = getBatchWorkerThreads();
    const maxParallelTasks = getBatchMaxParallelTasks();
    
    addBatchLog('开始批量处理', 'info');
    addBatchLog(`工作线程数: ${workerThreads}, 最大并行任务数: ${maxParallelTasks}`, 'info');
    
    // 禁用开始按钮
    startBatchBtn.disabled = true;
    
    // 为每个文件对创建任务面板
    filePairs.forEach((pair, index) => {
        if (pair.status !== 'completed' && pair.status !== 'processing') {
            createTaskPanel(pair, index);
            pair.status = 'waiting';
        }
    });
    
    // 获取要处理的文件对
    const pairsToProcess = filePairs.filter(pair => pair.status !== 'completed');
    
    // 使用用户设置的最大并行任务数
    
    // 创建任务处理函数
    const processPair = async (pair, index) => {
        // 如果已完成，跳过
        if (pair.status === 'completed') {
            return;
        }
        
        // 更新任务状态
        updateTaskStatus(index, 'uploading', '正在上传文件...');
        
        try {
            // 1. 同时上传音频文件和字幕文件（并行）
            const [audioPathResult, subtitlePathResult] = await Promise.all([
                uploadFile(pair.audioFile, 'background_music'),
                uploadFile(pair.subtitleFile, 'lrc')
            ]);
            
            pair.audioPath = audioPathResult;
            pair.subtitlePath = subtitlePathResult;
            
            // 3. 处理字幕生成语音
            updateTaskStatus(index, 'processing', '正在处理字幕生成语音...');
            const taskResult = await processSubtitle(
                pair.subtitlePath, 
                batchRefAudioPath, 
                serverUrl, 
                promptText, 
                weightsPath, 
                sovitsPath,
                index
            );
            
            if (taskResult.success) {
                pair.resultPath = taskResult.audio_path;
                
                // 4. 合并语音和背景音乐
                updateTaskStatus(index, 'merging', '正在合成最终音频...');
                const mergeResult = await mergeAudios(pair.resultPath, pair.audioPath);
                
                if (mergeResult.success) {
                    pair.mergedPath = mergeResult.audio_path;
                    updateTaskStatus(index, 'completed', '处理完成', pair.mergedPath);
                    pair.status = 'completed';
                } else {
                    updateTaskStatus(index, 'failed', `合成失败: ${mergeResult.error}`);
                    pair.status = 'failed';
                }
            } else {
                updateTaskStatus(index, 'failed', `处理失败: ${taskResult.error}`);
                pair.status = 'failed';
            }
        } catch (error) {
            console.error(`处理文件对 ${index + 1} 时出错:`, error);
            updateTaskStatus(index, 'failed', `处理错误: ${error.message}`);
            pair.status = 'failed';
        }
    };
    
    // 使用Promise.all和并发控制处理所有文件对
    const processBatch = async (pairs) => {
        // 创建任务队列
        const queue = [...pairs];
        const running = [];
        
        while (queue.length > 0 || running.length > 0) {
            // 填充运行中的任务队列直到达到最大并行数
            while (queue.length > 0 && running.length < maxParallelTasks) {
                const pair = queue.shift();
                const pairIndex = filePairs.indexOf(pair);
                
                // 开始处理并将Promise放入running数组
                const process = processPair(pair, pairIndex)
                    .then(() => {
                        // 任务完成后从running数组中移除
                        const index = running.indexOf(process);
                        if (index !== -1) running.splice(index, 1);
                    });
                running.push(process);
            }
            
            // 等待任意一个任务完成
            if (running.length > 0) {
                await Promise.race(running);
            }
        }
    };
    
    try {
        // 开始批量处理
        await processBatch(pairsToProcess);
        addBatchLog('批量处理完成', 'success');
    } catch (error) {
        addBatchLog(`批量处理出错: ${error.message}`, 'error');
    } finally {
        // 启用开始按钮
        startBatchBtn.disabled = false;
    }
}

/**
 * 上传单个文件
 * @param {File} file - 文件对象
 * @param {string} fileType - 文件类型
 * @returns {Promise<string>} 上传后的文件路径
 */
async function uploadFile(file, fileType) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', fileType);
        
        addBatchLog(`上传文件: ${file.name}`, 'info');
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                addBatchLog(`文件 ${file.name} 上传成功`, 'success');
                resolve(result.path);
            } else {
                addBatchLog(`文件 ${file.name} 上传失败: ${result.error}`, 'error');
                reject(new Error(result.error));
            }
        })
        .catch(error => {
            addBatchLog(`文件 ${file.name} 上传错误: ${error.message}`, 'error');
            reject(error);
        });
    });
}

/**
 * 处理字幕生成语音
 * @param {string} subtitlePath - 字幕文件路径
 * @param {string} refAudioPath - 参考音频路径
 * @param {string} serverUrl - API服务器地址
 * @param {string} promptText - 提示文本
 * @param {string} weightsPath - GPT模型路径
 * @param {string} sovitsPath - SoVITS模型路径
 * @param {number} taskIndex - 任务索引
 * @returns {Promise<Object>} 处理结果
 */
async function processSubtitle(subtitlePath, refAudioPath, serverUrl, promptText, weightsPath, sovitsPath, taskIndex) {
    return new Promise((resolve, reject) => {
        const taskId = Date.now() + taskIndex;
        activeTasks[taskId] = {
            index: taskIndex,
            subtitlePath: subtitlePath
        };
        
        addBatchLog(`开始处理字幕文件: ${subtitlePath}`, 'info');
        
        fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server_url: serverUrl,
                lrc_file: subtitlePath,
                ref_audio: refAudioPath,
                prompt_text: promptText,
                weights_path: weightsPath,
                sovits_path: sovitsPath,
                task_id: taskId,
                worker_threads: getBatchWorkerThreads()
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // 开始轮询进度
                pollProgress(result.job_id, taskIndex)
                    .then(finalResult => {
                        resolve(finalResult);
                    })
                    .catch(error => {
                        reject(error);
                    });
            } else {
                addBatchLog(`提交处理任务失败: ${result.error}`, 'error');
                reject(new Error(result.error));
            }
        })
        .catch(error => {
            addBatchLog(`提交处理任务错误: ${error.message}`, 'error');
            reject(error);
        });
    });
}

/**
 * 轮询任务进度
 * @param {string} jobId - 任务ID
 * @param {number} taskIndex - 任务索引
 * @returns {Promise<Object>} 最终处理结果
 */
async function pollProgress(jobId, taskIndex) {
    return new Promise((resolve, reject) => {
        const checkProgress = async () => {
            try {
                const response = await fetch(`/api/status?job_id=${jobId}`);
                const data = await response.json();
                
                if (data.status === 'completed') {
                    // 处理完成
                    updateTaskStatus(taskIndex, 'processed', '语音生成完成');
                    resolve(data.result);
                } else if (data.status === 'failed') {
                    // 处理失败
                    updateTaskStatus(taskIndex, 'failed', `处理失败: ${data.error || '未知错误'}`);
                    reject(new Error(data.error || '未知错误'));
                } else {
                    // 更新进度
                    if (data.progress) {
                        updateTaskStatus(
                            taskIndex, 
                            'processing', 
                            data.progress.message || '处理中...', 
                            null, 
                            data.progress.percent
                        );
                    }
                    
                    // 继续轮询
                    setTimeout(checkProgress, 1000);
                }
            } catch (error) {
                console.error('查询进度时出错:', error);
                
                // 出错后继续尝试
                setTimeout(checkProgress, 2000);
            }
        };
        
        // 开始检查进度
        checkProgress();
    });
}

/**
 * 合并语音和背景音乐
 * @param {string} vocalPath - 人声音频路径
 * @param {string} backgroundPath - 背景音乐路径
 * @returns {Promise<Object>} 合并结果
 */
async function mergeAudios(vocalPath, backgroundPath) {
    return new Promise((resolve, reject) => {
        addBatchLog(`开始合并音频: 人声=${vocalPath}, 背景=${backgroundPath}`, 'info');
        
        fetch('/api/merge-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vocal_path: vocalPath,
                background_path: backgroundPath,
                vocal_volume: 1.0,
                bg_volume: 0.5,
                stereo_mode: 'mix'
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                addBatchLog('音频合并成功', 'success');
                resolve(result);
            } else {
                addBatchLog(`音频合并失败: ${result.error}`, 'error');
                reject(new Error(result.error));
            }
        })
        .catch(error => {
            addBatchLog(`音频合并错误: ${error.message}`, 'error');
            reject(error);
        });
    });
}

/**
 * 创建任务面板
 * @param {Object} pair - 文件对
 * @param {number} index - 索引
 */
function createTaskPanel(pair, index) {
    // 检查任务面板是否已存在
    const existingPanel = document.getElementById(`task-${index}`);
    if (existingPanel) {
        return;
    }
    
    const taskPanel = document.createElement('div');
    taskPanel.className = 'batch-task';
    taskPanel.id = `task-${index}`;
    taskPanel.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">任务 ${index + 1}: ${pair.audioFile.name} + ${pair.subtitleFile.name}</h6>
            <span class="task-status" id="task-status-${index}">等待中</span>
        </div>
        <div class="progress mb-2">
            <div class="progress-bar task-progress" id="task-progress-${index}" role="progressbar" style="width: 0%"></div>
        </div>
        <div class="task-message small text-muted" id="task-message-${index}">准备处理...</div>
        <div class="task-result mt-2" id="task-result-${index}" style="display: none;">
            <audio controls style="width: 100%;" id="task-audio-${index}"></audio>
            <div class="mt-1">
                <button class="btn btn-sm btn-outline-primary download-result" data-path="" id="task-download-${index}">下载</button>
            </div>
        </div>
    `;
    
    batchTasksContainer.appendChild(taskPanel);
    
    // 添加下载事件
    document.getElementById(`task-download-${index}`).addEventListener('click', function() {
        const path = this.getAttribute('data-path');
        if (path) {
            downloadFile(path);
        }
    });
}

/**
 * 更新任务状态
 * @param {number} index - 任务索引
 * @param {string} status - 状态
 * @param {string} message - 消息
 * @param {string} resultPath - 结果文件路径(可选)
 * @param {number} progress - 进度百分比(0-100,可选)
 */
function updateTaskStatus(index, status, message, resultPath = null, progress = null) {
    const statusElement = document.getElementById(`task-status-${index}`);
    const progressElement = document.getElementById(`task-progress-${index}`);
    const messageElement = document.getElementById(`task-message-${index}`);
    const resultElement = document.getElementById(`task-result-${index}`);
    const audioElement = document.getElementById(`task-audio-${index}`);
    const downloadBtn = document.getElementById(`task-download-${index}`);
    
    if (!statusElement) return;
    
    // 更新状态
    let statusText = '处理中';
    let statusClass = 'text-primary';
    
    switch (status) {
        case 'waiting':
            statusText = '等待中';
            statusClass = 'text-secondary';
            break;
        case 'uploading':
            statusText = '上传中';
            statusClass = 'text-info';
            break;
        case 'processing':
            statusText = '处理中';
            statusClass = 'text-primary';
            break;
        case 'processed':
            statusText = '已生成语音';
            statusClass = 'text-info';
            break;
        case 'merging':
            statusText = '合成中';
            statusClass = 'text-warning';
            break;
        case 'completed':
            statusText = '完成';
            statusClass = 'text-success';
            break;
        case 'failed':
            statusText = '失败';
            statusClass = 'text-danger';
            break;
    }
    
    statusElement.textContent = statusText;
    statusElement.className = `task-status ${statusClass}`;
    
    // 更新消息
    if (message) {
        messageElement.textContent = message;
    }
    
    // 更新进度
    if (progress !== null) {
        progressElement.style.width = `${progress}%`;
    }
    
    // 如果完成，显示结果
    if (resultPath && status === 'completed') {
        resultElement.style.display = 'block';
        audioElement.src = `/merged_audio/${resultPath.split('/').pop()}`;
        downloadBtn.setAttribute('data-path', resultPath);
    }
}

/**
 * 清空文件
 */
function clearFiles() {
    filePairs = [];
    updateFilePairsUI();
    addBatchLog('已清空所有文件', 'info');
}

/**
 * 下载文件
 * @param {string} filePath - 文件路径
 */
function downloadFile(filePath) {
    // 创建下载链接
    const downloadUrl = `/api/download/${filePath}`;
    
    addBatchLog(`开始下载文件: ${filePath}`, 'info');
    
    // 创建临时链接并点击
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * 添加批处理日志
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型 (info, success, error, warning)
 */
function addBatchLog(message, type = 'info') {
    // 创建日志条目
    const logEntry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    // 设置日志样式
    let textClass = 'text-secondary';
    switch (type) {
        case 'success':
            textClass = 'text-success';
            break;
        case 'error':
            textClass = 'text-danger';
            break;
        case 'warning':
            textClass = 'text-warning';
            break;
        case 'info':
        default:
            textClass = 'text-info';
    }
    
    logEntry.className = textClass;
    
    // 设置日志内容
    logEntry.innerHTML = `<small>[${timestamp}] ${message}</small>`;
    
    // 添加到日志输出区域
    batchLogOutput.appendChild(logEntry);
    
    // 滚动到最新日志
    batchLogOutput.scrollTop = batchLogOutput.scrollHeight;
    
    // 同时输出到控制台
    console.log(`[${timestamp}] ${message}`);
}

/**
 * 清空批处理日志
 */
function clearBatchLog() {
    batchLogOutput.innerHTML = '';
    addBatchLog('日志已清空', 'info');
} 