#!/bin/bash

echo "===================================================================="
echo "                GPT-SoVITS Web UI 启动脚本 (Linux/macOS)"
echo "===================================================================="
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未检测到Python3，请确保已安装Python 3.9+"
    echo "      可以通过以下命令安装Python："
    echo "      - Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv"
    echo "      - CentOS/RHEL: sudo yum install python3 python3-pip"
    echo "      - macOS: brew install python3"
    exit 1
fi

# 检查是否需要安装依赖
if [ ! -d "venv" ]; then
    echo "[信息] 首次运行，正在创建虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    echo "[信息] 正在安装依赖，这可能需要几分钟时间..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请检查网络连接或手动安装："
        echo "      pip install -r requirements.txt"
        exit 1
    fi
else
    source venv/bin/activate
fi

# 创建必要的目录
mkdir -p uploads/lrc
mkdir -p uploads/ref_audio
mkdir -p uploads/background_music
mkdir -p wav_file
mkdir -p merged_audio

# 设置权限
chmod -R 755 uploads
chmod -R 755 wav_file
chmod -R 755 merged_audio

# 启动GPT-SoVITS WebUI
echo "[信息] 正在启动GPT-SoVITS Web UI，请稍候..."
echo "[信息] 启动后，请在浏览器中访问: http://127.0.0.1:5000"
echo ""
echo "[提示] 按Ctrl+C可以停止服务器"
echo ""

# 捕获Ctrl+C信号
trap 'echo -e "\n[信息] 服务器已停止"; exit 0' INT

python app.py 