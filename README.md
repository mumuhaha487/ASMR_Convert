# GPT-SoVITS Web UI

一个简单易用的GPT-SoVITS语音合成Web界面，支持LRC歌词转换为语音并与背景音乐合成。

## 使用教程
[教程]([http://write.blog.csdn.net/postlist](https://www.bilibili.com/video/BV1e2RqYBETj))

## 功能特点

- **LRC歌词转语音**：将LRC格式歌词文件转换为语音
- **参考音频设置**：使用参考音频控制合成语音的声音特征
- **背景音乐合成**：支持将生成的语音与背景音乐合成
- **多种混音模式**：
  - 混合模式：人声和背景音乐混合在两个声道
  - 左右声道分离：可将人声和背景音乐分别放在左右声道
- **音量控制**：独立调节人声和背景音乐的音量
- **实时进度显示**：处理过程中显示详细的进度和日志
- **缓存管理**：一键清理所有缓存文件

## 系统要求

- Python 3.9+
- 足够的磁盘空间用于存储音频文件和模型
- 支持的操作系统：Windows、Linux、macOS

## 安装

1. 克隆本仓库：

```bash
git clone https://github.com/mumuhaha487/ASMR_Convert.git
cd ASMR_Convert
```

2. 安装依赖：

```bash
pip install -r requirements.txt
```


## 使用方法

### 启动Web服务




直接通过Python启动：
```
python app.py
```

启动后，通过浏览器访问：`http://127.0.0.1:5000`

### 基本使用流程

1. **基本设置**：
   - 设置API服务器地址（默认为`http://127.0.0.1:9872/`）
   - 设置GPT模型路径（默认为`GPT_weights/`）
   - 设置SoVITS模型路径（默认为`SoVITS_weights/`）

2. **上传文件**：
   - 上传LRC歌词文件
   - 上传参考音频（WAV或MP3格式）
   - 可选：上传背景音乐（WAV或MP3格式）

3. **合成语音**：
   - 点击"处理LRC生成音频"按钮
   - 等待处理完成（可以查看实时进度和日志）

4. **音频合成**（如果上传了背景音乐）：
   - 调整人声和背景音乐的音量
   - 选择声道模式（混合、人声左声道或人声右声道）
   - 点击"合成音频"按钮

5. **下载结果**：
   - 可以下载原始生成的语音或与背景音乐合成后的音频

### 高级设置

- **参考音频文本**：可以设置参考音频对应的文本，以提高模型效果
- **缓存清理**：点击"清理缓存"按钮可以清除所有上传的文件和生成的音频

## 文件结构

```
├── app.py                # 主应用Flask服务器
├── main.py               # GPT-SoVITS接口封装
├── audio_utils.py        # 音频处理工具
├── requirements.txt      # 依赖库列表
├── static/               # 静态文件目录
│   ├── css/              # CSS样式文件
│   └── js/               # JavaScript脚本文件
├── templates/            # HTML模板目录
├── uploads/              # 上传文件存储目录
├── wav_file/             # 生成的音频文件存储目录
└── merged_audio/         # 合成后的音频文件存储目录
```

## 故障排除

1. **文件上传失败**
   - 检查文件格式是否正确
   - 确保文件名不包含特殊字符

2. **语音生成失败**
   - 检查API服务器地址是否正确
   - 确保GPT和SoVITS模型路径设置正确

3. **音频合成问题**
   - 如果合成的音频有问题，尝试调整音量设置
   - 确保背景音乐格式受支持（WAV或MP3）

## 技术说明

- 前端：使用Bootstrap 5和原生JavaScript构建
- 后端：基于Flask的RESTful API
- 音频处理：使用librosa和soundfile处理音频数据
- 并发处理：使用线程池处理请求，避免阻塞

## 许可证

[MIT License](LICENSE)

## 鸣谢

- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) - 基础的语音合成模型
- [Flask](https://flask.palletsprojects.com/) - Web框架
- [Bootstrap](https://getbootstrap.com/) - 前端框架
- [librosa](https://librosa.org/) - 音频处理库 
