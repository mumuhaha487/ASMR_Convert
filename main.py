from gradio_client import Client, file
import os
import shutil
import re
import time
from audio_utils import combine_audio_files

class VoiceGenerator:
    def __init__(self, server_url="http://127.0.0.1:9872/"):
        self.client = Client(server_url)
        self.wav_dir = "wav_file"
        if not os.path.exists(self.wav_dir):
            os.makedirs(self.wav_dir)
            
    def init_models(self):
        """初始化模型"""
        # 初始化GPT模型
        self.client.predict(
            weights_path="GPT_weights/格蕾修-e10.ckpt",
            api_name="/init_t2s_weights"
        )
        
        # 初始化SoVITS模型
        self.client.predict(
            sovits_path="SoVITS_weights/格蕾修_e10_s130.pth",
            prompt_language="中文",
            text_language="中文",
            api_name="/change_sovits_weights"
        )

    def parse_lrc(self, lrc_file):
        """解析LRC文件"""
        lyrics = []
        with open(lrc_file, 'r', encoding='utf-8') as f:
            for line in f:
                match = re.match(r'\[(\d{2}):(\d{2})\.(\d{3})\](.*)', line.strip())
                if match:
                    minutes, seconds, milliseconds, text = match.groups()
                    timestamp = int(minutes) * 60000 + int(seconds) * 1000 + int(milliseconds)
                    if text.strip():  # 只添加非空文本
                        lyrics.append((timestamp, text.strip()))
        return lyrics

    def generate_single_audio(self, text, ref_audio_path):
        """生成单条语音"""
        # 确保 ref_audio_path 是 gradio_client.file 对象或字符串
        if not isinstance(ref_audio_path, str) and hasattr(ref_audio_path, '__call__'):
            # 已经是 file 函数返回的对象或其他可调用对象
            ref_audio = ref_audio_path
        else:
            # 是字符串路径，需要包装成 file 对象
            ref_audio = file(ref_audio_path)
            
        result = self.client.predict(
            text=text,
            text_lang="中文",
            ref_audio_path=ref_audio,
            aux_ref_audio_paths=[],
            prompt_text="",
            prompt_lang="中文",
            api_name="/inference"
        )
        
        # 获取生成的音频文件路径并复制到输出目录
        audio_path = result[0]
        file_name = f"{int(time.time()*1000)}.wav"
        target_path = os.path.join(self.wav_dir, file_name)
        shutil.copy2(audio_path, target_path)
        
        return target_path

    def process_lrc(self, lrc_file, ref_audio_path):
        """处理整个LRC文件"""
        # 初始化模型
        self.init_models()
        
        # 解析LRC文件
        lyrics = self.parse_lrc(lrc_file)
        audio_files = []
        
        # 生成每条语音
        total = len(lyrics)
        for i, (timestamp, text) in enumerate(lyrics, 1):
            print(f"正在处理 [{i}/{total}]: {text}")
            try:
                audio_path = self.generate_single_audio(text, ref_audio_path)
                audio_files.append((timestamp, audio_path))
                time.sleep(1)  # 避免请求过快
            except Exception as e:
                print(f"处理文本时出错: {text}")
                print(f"错误信息: {str(e)}")
        
        # 合成最终音频
        output_path = os.path.join(self.wav_dir, "final_audio.wav")
        combine_audio_files(audio_files, output_path)
        
        return output_path

def main():
    # 配置参数
    lrc_file = "music_yuan/123.lrc"
    ref_audio = "衣服上的颜料洗不掉了，你可以帮帮我吗？.wav"
    
    # 创建生成器实例
    generator = VoiceGenerator()
    
    try:
        # 处理LRC文件
        output_path = generator.process_lrc(lrc_file, ref_audio)
        print(f"处理完成！最终文件保存在: {output_path}")
    except Exception as e:
        print(f"处理过程中出现错误: {str(e)}")

if __name__ == "__main__":
    main()