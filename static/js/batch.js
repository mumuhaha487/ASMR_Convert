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
const batchRetryCountSelect = document.getElementById('batchRetryCount');
const customBatchRetryCountInput = document.getElementById('customBatchRetryCount');
// 音频合成调整元素
const batchVocalVolume = document.getElementById('batchVocalVolume');
const batchBgVolume = document.getElementById('batchBgVolume');
const batchVocalVolumeValue = document.getElementById('batchVocalVolumeValue');
const batchBgVolumeValue = document.getElementById('batchBgVolumeValue');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFilesBtn = document.getElementById('selectFilesBtn');
const filePairsContainer = document.getElementById('filePairs');
const startBatchBtn = document.getElementById('startBatchBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const stopAllTasksBtn = document.getElementById('stopAllTasksBtn');
const batchTasksContainer = document.getElementById('batchTasksContainer');
const noTasksMsg = document.getElementById('noTasksMsg');
const batchLogOutput = document.getElementById('batchLogOutput');
const batchClearLogBtn = document.getElementById('batchClearLogBtn');
const taskControlTemplate = document.getElementById('taskControlTemplate');

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
    
    // 停止所有任务
    stopAllTasksBtn.addEventListener('click', stopAllTasks);
    
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
    
    // 重试次数自定义选项
    batchRetryCountSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customBatchRetryCountInput.style.display = 'block';
            customBatchRetryCountInput.focus();
        } else {
            customBatchRetryCountInput.style.display = 'none';
        }
    });
    
    // 音量滑块事件
    batchVocalVolume.addEventListener('input', function() {
        batchVocalVolumeValue.textContent = this.value;
    });
    
    batchBgVolume.addEventListener('input', function() {
        batchBgVolumeValue.textContent = this.value;
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
 * 获取重试次数
 * @returns {number} 重试次数
 */
function getBatchRetryCount() {
    if (batchRetryCountSelect.value === 'custom' && customBatchRetryCountInput.value) {
        const customValue = parseInt(customBatchRetryCountInput.value);
        if (!isNaN(customValue) && customValue >= 0) {
            return customValue;
        }
    }
    return parseInt(batchRetryCountSelect.value) || 3; // 默认3次重试
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
        alert('请先添加文件对');
        return;
    }
    
    if (!batchRefAudioPath) {
        alert('请先上传参考音频');
        return;
    }
    
    // 检查是否有任务正在进行
    const activeTaskCount = Object.keys(activeTasks).filter(key => activeTasks[key].status !== 'completed' && activeTasks[key].status !== 'failed' && activeTasks[key].status !== 'stopped').length;
    if (activeTaskCount > 0) {
        if (!confirm(`有 ${activeTaskCount} 个任务正在处理中，确认要添加新任务吗？`)) {
            return;
        }
    }
    
    // 清空任务容器的初始消息
    noTasksMsg.style.display = 'none';
    
    // 显示停止所有任务按钮
    stopAllTasksBtn.style.display = 'inline-block';
    
    // 获取待处理的文件对（仅状态为waiting的）
    const waitingPairs = filePairs.filter(pair => pair.status === 'waiting');
    
    // 处理获取参数
    const apiServer = batchApiServerInput.value.trim();
    const gptPath = batchGptPathInput.value.trim();
    const sovitsPath = batchSovitsPathInput.value.trim();
    const promptText = batchRefTextInput.value.trim();
    const maxParallelTasks = getBatchMaxParallelTasks();
    const workerThreads = getBatchWorkerThreads();
    const retryCount = getBatchRetryCount();
    
    addBatchLog(`开始批量处理 ${waitingPairs.length} 个文件对`, 'info');
    addBatchLog(`API服务器: ${apiServer}`, 'info');
    addBatchLog(`GPT模型路径: ${gptPath}`, 'info');
    addBatchLog(`SoVITS模型路径: ${sovitsPath}`, 'info');
    addBatchLog(`最大并行任务数: ${maxParallelTasks}`, 'info');
    addBatchLog(`每任务工作线程数: ${workerThreads}`, 'info');
    addBatchLog(`失败重试次数: ${retryCount}`, 'info');
    
    // 设置处理单个任务的函数
    const processPair = async (pair, index) => {
        // 如果已经处理过或失败，则跳过
        if (pair.status !== 'waiting') {
            return;
        }
        
        try {
            // 更新状态为处理中
            updateTaskStatus(index, 'processing', '正在上传文件...');
            
            // 上传字幕文件
            const subtitleResponse = await uploadFile(pair.subtitleFile, 'lrc');
            if (!subtitleResponse.success) {
                throw new Error(`上传字幕文件失败: ${subtitleResponse.error}`);
            }
            
            // 上传音频文件
            const audioResponse = await uploadFile(pair.audioFile, 'background_music');
            if (!audioResponse.success) {
                throw new Error(`上传音频文件失败: ${audioResponse.error}`);
            }
            
            // 保存上传后的路径
            pair.subtitlePath = subtitleResponse.path;
            pair.audioPath = audioResponse.path;
            
            // 处理字幕生成人声
            updateTaskStatus(index, 'processing', '正在处理字幕...');
            
            // 这里开始处理字幕生成人声
            const processResult = await processSubtitle(
                pair.subtitlePath,
                batchRefAudioPath,
                apiServer,
                promptText,
                gptPath,
                sovitsPath,
                index,
                workerThreads,
                retryCount
            );
            
            // 添加停止按钮
            const taskPanel = document.getElementById(`task-${index}`);
            if (taskPanel) {
                // 创建任务控制元素
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'task-controls mt-1';
                controlsDiv.innerHTML = `<button class="btn btn-sm btn-danger stop-task-btn" data-task-id="${processResult.jobId}" data-index="${index}">停止任务</button>`;
                
                // 添加到任务面板
                taskPanel.querySelector('.task-status-container').appendChild(controlsDiv);
                
                // 绑定停止任务按钮点击事件
                controlsDiv.querySelector('.stop-task-btn').addEventListener('click', function() {
                    const taskId = this.getAttribute('data-task-id');
                    const taskIndex = this.getAttribute('data-index');
                    stopTask(taskId, parseInt(taskIndex));
                });
            }
            
        } catch (error) {
            updateTaskStatus(index, 'failed', `处理失败: ${error.message}`);
            addBatchLog(`任务 #${index + 1} 失败: ${error.message}`, 'error');
        }
    };
    
    // 并行处理任务
    const processBatch = async (pairs) => {
        // 计算活动任务数
        const getActiveCount = () => {
            return Object.keys(activeTasks).filter(key => 
                activeTasks[key].status === 'processing' || 
                activeTasks[key].status === 'pending'
            ).length;
        };
        
        // 任务队列
        const queue = [...pairs];
        
        // 循环处理队列
        while (queue.length > 0) {
            // 检查当前活动任务数
            const activeCount = getActiveCount();
            
            // 如果活动任务数小于最大并行数，则处理下一个
            if (activeCount < maxParallelTasks) {
                const pair = queue.shift();
                const index = filePairs.indexOf(pair);
                
                if (index >= 0) {
                    // 创建任务面板（如果尚未创建）
                    if (!document.getElementById(`task-${index}`)) {
                        const taskPanel = createTaskPanel(pair, index);
                        batchTasksContainer.appendChild(taskPanel);
                    }
                    
                    // 开始处理任务
                    processPair(pair, index);
                }
            }
            
            // 等待一段时间再检查
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    };
    
    // 开始处理队列
    processBatch(waitingPairs);
}

/**
 * 轮询任务进度
 * @param {string} jobId - 任务ID
 * @param {number} taskIndex - 任务索引
 */
async function pollProgress(jobId, taskIndex) {
    // 保存上次的进度，用于比较变化
    let lastPercent = 0;
    let lastMessage = '';
    let lastLogMessage = '';
    
    const checkProgress = async () => {
        try {
            const response = await fetch(`/api/status?job_id=${jobId}`);
            const status = await response.json();
            
            if (status.status === 'not_found') {
                throw new Error('任务不存在');
            }
            
            // 更新活动任务状态
            if (activeTasks[jobId]) {
                activeTasks[jobId].status = status.status;
            }
            
            // 更新进度，避免太多重复日志
            if (status.progress && status.progress.percent !== undefined) {
                const currentPercent = status.progress.percent;
                const currentMessage = status.progress.message || '';
                
                // 只有当百分比或消息发生变化时才更新UI
                if (currentPercent !== lastPercent || currentMessage !== lastMessage) {
                    updateTaskStatus(taskIndex, 'processing', currentMessage, null, currentPercent);
                    lastPercent = currentPercent;
                    lastMessage = currentMessage;
                }
            }
            
            // 显示日志，避免重复
            if (status.progress && status.progress.logs && status.progress.logs.length > 0) {
                const lastLog = status.progress.logs[status.progress.logs.length - 1];
                // 只显示新的、不同的日志
                if (lastLog && lastLog !== lastLogMessage) {
                    addBatchLog(`任务 #${taskIndex + 1}: ${lastLog}`, 'info');
                    lastLogMessage = lastLog;
                }
            }
            
            // 处理完成
            if (status.status === 'completed') {
                // 显示结果
                if (status.result && status.result.audio_path) {
                    // 找到对应的文件对
                    const pair = filePairs[taskIndex];
                    if (pair) {
                        pair.resultPath = status.result.audio_path;
                        pair.resultUrl = status.result.audio_url;
                        pair.status = 'completed';
                        
                        // 更新UI显示
                        updateTaskStatus(taskIndex, 'completed', '处理完成', status.result.audio_path);
                        
                        // 检查是否需要合并音频
                        if (pair.audioPath) {
                            // 合并人声和背景音乐
                            mergeAudios(status.result.audio_path, pair.audioPath, taskIndex);
                        }
                    }
                    
                    addBatchLog(`任务 #${taskIndex + 1} 处理完成`, 'success');
                } else {
                    updateTaskStatus(taskIndex, 'completed', '处理完成，但未返回音频路径');
                    addBatchLog(`任务 #${taskIndex + 1} 处理完成，但未返回音频路径`, 'warning');
                }
                
                // 移除停止按钮
                const taskPanel = document.getElementById(`task-${taskIndex}`);
                if (taskPanel) {
                    const stopBtn = taskPanel.querySelector('.stop-task-btn');
                    if (stopBtn) {
                        stopBtn.remove();
                    }
                }
                
                // 从活动任务中删除
                if (jobId in activeTasks) {
                    delete activeTasks[jobId];
                }
                
                return;
            }
            // 处理失败
            else if (status.status === 'failed') {
                updateTaskStatus(taskIndex, 'failed', `处理失败: ${status.error || '未知错误'}`);
                addBatchLog(`任务 #${taskIndex + 1} 处理失败: ${status.error || '未知错误'}`, 'error');
                
                // 移除停止按钮
                const taskPanel = document.getElementById(`task-${taskIndex}`);
                if (taskPanel) {
                    const stopBtn = taskPanel.querySelector('.stop-task-btn');
                    if (stopBtn) {
                        stopBtn.remove();
                    }
                }
                
                // 从活动任务中删除
                if (jobId in activeTasks) {
                    delete activeTasks[jobId];
                }
                
                return;
            }
            // 处理被停止
            else if (status.status === 'stopped' || status.status === 'stopping') {
                updateTaskStatus(taskIndex, 'stopped', `任务已停止: ${status.error || '用户手动停止'}`);
                addBatchLog(`任务 #${taskIndex + 1} 已停止: ${status.error || '用户手动停止'}`, 'warning');
                
                // 移除停止按钮
                const taskPanel = document.getElementById(`task-${taskIndex}`);
                if (taskPanel) {
                    const stopBtn = taskPanel.querySelector('.stop-task-btn');
                    if (stopBtn) {
                        stopBtn.remove();
                    }
                }
                
                // 从活动任务中删除
                if (jobId in activeTasks) {
                    delete activeTasks[jobId];
                }
                
                return;
            }
            
            // 继续轮询
            setTimeout(checkProgress, 1000);
        } catch (error) {
            console.error('轮询进度出错:', error);
            addBatchLog(`轮询进度出错: ${error.message}`, 'error');
            
            // 出错后继续尝试，但间隔更长
            setTimeout(checkProgress, 3000);
        }
    };
    
    // 开始轮询
    checkProgress();
}

/**
 * 停止单个任务
 * @param {string} jobId - 任务ID
 * @param {number} index - 任务索引
 */
async function stopTask(jobId, index) {
    try {
        addBatchLog(`正在尝试停止任务 #${index + 1}...`, 'warning');
        
        // 找到并禁用该任务的停止按钮
        const taskPanel = document.getElementById(`task-${index}`);
        if (taskPanel) {
            const stopBtn = taskPanel.querySelector('.stop-task-btn');
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.textContent = '正在停止...';
            }
        }
        
        // 发送停止任务请求
        const response = await fetch('/api/stop-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: jobId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addBatchLog(`已发送停止任务 #${index + 1} 信号`, 'success');
            updateTaskStatus(index, 'stopping', '正在停止...');
        } else {
            // 如果返回任务不存在，不显示为错误，而是提示用户
            if (result.error === '任务不存在') {
                addBatchLog(`任务 #${index + 1} 可能已完成或不存在，无需停止`, 'info');
                // 直接从UI上移除停止按钮
                if (taskPanel) {
                    const stopBtn = taskPanel.querySelector('.stop-task-btn');
                    if (stopBtn) {
                        stopBtn.remove();
                    }
                }
                // 从活动任务中删除
                if (jobId in activeTasks) {
                    delete activeTasks[jobId];
                }
            } else {
                throw new Error(result.error || '停止任务失败');
            }
        }
    } catch (error) {
        addBatchLog(`停止任务 #${index + 1} 出错: ${error.message}`, 'error');
        // 恢复按钮状态
        const taskPanel = document.getElementById(`task-${index}`);
        if (taskPanel) {
            const stopBtn = taskPanel.querySelector('.stop-task-btn');
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.textContent = '停止任务';
            }
        }
    }
}

/**
 * 停止所有任务
 */
async function stopAllTasks() {
    // 寻找所有正在进行的任务
    const runningTasks = Object.keys(activeTasks).filter(
        key => activeTasks[key].status === 'processing' || activeTasks[key].status === 'pending'
    );
    
    if (runningTasks.length === 0) {
        addBatchLog('没有正在进行的任务', 'warning');
        return;
    }
    
    if (!confirm(`确定要停止所有 ${runningTasks.length} 个正在进行的任务吗？`)) {
        return;
    }
    
    // 禁用停止所有任务按钮
    stopAllTasksBtn.disabled = true;
    stopAllTasksBtn.textContent = '正在停止所有任务...';
    
    addBatchLog(`正在尝试停止所有任务 (${runningTasks.length} 个)...`, 'warning');
    
    // 并行停止所有任务
    const stopPromises = runningTasks.map(taskId => {
        // 先禁用各个任务的停止按钮
        const taskIndex = activeTasks[taskId].taskIndex;
        const taskPanel = document.getElementById(`task-${taskIndex}`);
        if (taskPanel) {
            const stopBtn = taskPanel.querySelector('.stop-task-btn');
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.textContent = '正在停止...';
            }
        }
        
        return fetch('/api/stop-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: taskId
            })
        }).then(res => res.json());
    });
    
    try {
        const results = await Promise.allSettled(stopPromises);
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        
        addBatchLog(`已发送停止信号: ${succeeded}/${runningTasks.length} 个任务`, 'info');
        
        // 更新所有任务的状态为停止中
        runningTasks.forEach(taskId => {
            const taskIndex = activeTasks[taskId].taskIndex;
            updateTaskStatus(taskIndex, 'stopping', '正在停止...');
        });
        
        // 恢复按钮状态
        stopAllTasksBtn.disabled = false;
        stopAllTasksBtn.textContent = '停止所有任务';
    } catch (error) {
        addBatchLog(`停止所有任务时出错: ${error.message}`, 'error');
        // 恢复按钮状态
        stopAllTasksBtn.disabled = false;
        stopAllTasksBtn.textContent = '停止所有任务';
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
                resolve(result);
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
 * 处理字幕生成人声
 * @param {string} subtitlePath - 字幕文件路径
 * @param {string} refAudioPath - 参考音频路径
 * @param {string} serverUrl - API服务器地址
 * @param {string} promptText - 提示文本
 * @param {string} weightsPath - GPT模型路径
 * @param {string} sovitsPath - SoVITS模型路径
 * @param {number} taskIndex - 任务索引
 * @param {number} workerThreads - 工作线程数
 * @param {number} retryCount - 失败重试次数
 * @returns {Object} 处理结果
 */
async function processSubtitle(subtitlePath, refAudioPath, serverUrl, promptText, weightsPath, sovitsPath, taskIndex, workerThreads = 4, retryCount = 3) {
    try {
        // 生成任务ID
        const taskId = Date.now() + '_' + taskIndex;
        
        // 更新任务状态
        updateTaskStatus(taskIndex, 'processing', '正在提交任务...');
        
        addBatchLog(`提交任务 #${taskIndex + 1}`, 'info');
        addBatchLog(`字幕文件: ${subtitlePath}`, 'info');
        addBatchLog(`参考音频: ${refAudioPath}`, 'info');
        addBatchLog(`工作线程数: ${workerThreads}`, 'info');
        addBatchLog(`失败重试次数: ${retryCount}`, 'info');
        
        // 提交处理请求
        const response = await fetch('/api/process', {
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
                worker_threads: workerThreads,
                retry_count: retryCount
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addBatchLog(`任务 #${taskIndex + 1} 已提交，开始监控进度 (ID: ${result.job_id})`, 'info');
            
            // 记录活动任务，包含任务索引，便于后续引用
            activeTasks[result.job_id] = {
                taskIndex,
                status: 'processing'
            };
            
            // 开始轮询进度
            pollProgress(result.job_id, taskIndex);
            
            return {
                success: true,
                jobId: result.job_id
            };
        } else {
            throw new Error(result.error || '提交任务失败');
        }
    } catch (error) {
        updateTaskStatus(taskIndex, 'failed', `任务提交失败: ${error.message}`);
        throw error;
    }
}

/**
 * 合并语音和背景音乐
 * @param {string} vocalPath - 人声音频路径
 * @param {string} backgroundPath - 背景音乐路径
 * @returns {Promise<Object>} 合并结果
 */
async function mergeAudios(vocalPath, backgroundPath) {
    return new Promise((resolve, reject) => {
        // 获取音量和声道模式设置
        const vocalVol = parseFloat(batchVocalVolume.value);
        const bgVol = parseFloat(batchBgVolume.value);
        const stereoMode = document.querySelector('input[name="batchStereoMode"]:checked').value;
        
        addBatchLog(`开始合并音频: 人声=${vocalPath}, 背景=${backgroundPath}`, 'info');
        addBatchLog(`人声音量: ${vocalVol}, 背景音量: ${bgVol}, 声道模式: ${stereoMode}`, 'info');
        
        fetch('/api/merge-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vocal_path: vocalPath,
                background_path: backgroundPath,
                vocal_volume: vocalVol,
                bg_volume: bgVol,
                stereo_mode: stereoMode
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