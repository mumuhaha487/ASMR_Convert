import numpy as np
from scipy.io import wavfile
import os
import librosa
import soundfile as sf

def combine_audio_files(audio_files, output_path):
    """将多个音频文件按照时间戳拼接"""
    if not audio_files:
        raise ValueError("没有音频文件可供拼接")
    
    # 按照时间戳排序
    audio_files.sort(key=lambda x: x[0])
    
    # 计算最大时长 (毫秒)
    max_time = max([timestamp for timestamp, _ in audio_files])
    
    # 读取第一个文件以获取采样率
    sample_rate, _ = wavfile.read(audio_files[0][1])
    
    # 计算总长度 (采样点)
    total_duration_ms = max_time + 10000  # 加10秒确保有足够空间
    total_samples = int(total_duration_ms * sample_rate / 1000)
    
    # 创建空白音频数组
    combined = np.zeros(total_samples, dtype=np.float32)
    
    # 添加每个音频片段
    for i, (timestamp, audio_path) in enumerate(audio_files):
        # 转换时间戳为采样点位置
        start_sample = int(timestamp * sample_rate / 1000)
        
        # 读取音频文件
        _, audio_data = wavfile.read(audio_path)
        
        # 将数据转换为浮点数进行拼接
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32) / 32768.0  # 归一化
        
        # 确保不超出数组范围
        end_sample = min(start_sample + len(audio_data), len(combined))
        
        # 检查是否有下一个音频片段
        if i < len(audio_files) - 1:
            next_timestamp = audio_files[i+1][0]
            next_start_sample = int(next_timestamp * sample_rate / 1000)
            
            # 如果当前片段会超出下一个片段的开始位置，截断当前片段
            if start_sample + len(audio_data) > next_start_sample:
                print(f"截断音频片段 {i+1}/{len(audio_files)}: {audio_path}")
                end_sample = min(end_sample, next_start_sample)
        
        # 插入音频数据
        combined[start_sample:end_sample] = audio_data[:end_sample-start_sample]
        print(f"添加音频片段 {i+1}/{len(audio_files)}: 时间戳={timestamp}ms, 长度={len(audio_data)}样本")
    
    # 归一化并转换回16位整数
    combined = np.clip(combined, -1.0, 1.0)
    combined = (combined * 32767).astype(np.int16)
    
    # 写入输出文件
    wavfile.write(output_path, sample_rate, combined)
    print(f"音频合成完成：{output_path}, 总长度: {total_samples/sample_rate:.2f}秒")
    return output_path

def merge_audio_with_background(vocal_path, background_path, output_path, vocal_volume=1.0, bg_volume=1.0, stereo_mode="mix"):
    """
    将人声与背景音乐合并
    
    参数:
    vocal_path: 人声音频文件路径
    background_path: 背景音乐文件路径
    output_path: 输出文件路径
    vocal_volume: 人声音量 (0.0-2.0)
    bg_volume: 背景音乐音量 (0.0-2.0)
    stereo_mode: 混音模式 - "mix"(混合), "left"(人声左声道), "right"(人声右声道)
    """
    print(f"合并音频: 人声={vocal_path}, 背景={background_path}")
    
    try:
        # 读取人声文件
        vocal_data, vocal_sr = librosa.load(vocal_path, sr=None, mono=True)
        
        # 读取背景音乐文件，可能是mp3或wav
        bg_data, bg_sr = librosa.load(background_path, sr=None, mono=True)
        
        # 如果采样率不同，将背景音乐重采样为与人声相同的采样率
        if bg_sr != vocal_sr:
            print(f"重采样背景音乐: {bg_sr} -> {vocal_sr}")
            bg_data = librosa.resample(bg_data, orig_sr=bg_sr, target_sr=vocal_sr)
            bg_sr = vocal_sr
        
        # 应用音量调整
        vocal_data = vocal_data * vocal_volume
        bg_data = bg_data * bg_volume
        
        # 确定最长的音频，以此为准
        max_length = max(len(vocal_data), len(bg_data))
        
        # 如果人声较短，用静默（零值）填充至最长音频的长度
        if len(vocal_data) < max_length:
            print(f"填充人声静默: {len(vocal_data)} -> {max_length}")
            # 创建零填充数组（静默）
            silence = np.zeros(max_length - len(vocal_data))
            # 将人声与静默连接
            vocal_data = np.concatenate([vocal_data, silence])
            
        # 如果背景音乐较短，用静默（零值）填充至最长音频的长度
        if len(bg_data) < max_length:
            print(f"填充背景音乐静默: {len(bg_data)} -> {max_length}")
            # 创建零填充数组（静默）
            silence = np.zeros(max_length - len(bg_data))
            # 将背景音乐与静默连接
            bg_data = np.concatenate([bg_data, silence])
        
        # 根据不同的立体声模式处理
        if stereo_mode == "left":
            # 人声放左声道，背景音乐放右声道
            stereo_data = np.vstack((vocal_data, bg_data)).T
        elif stereo_mode == "right":
            # 人声放右声道，背景音乐放左声道
            stereo_data = np.vstack((bg_data, vocal_data)).T
        else:  # "mix" 模式
            # 人声和背景音乐混合
            mixed_data = (vocal_data + bg_data) / 2
            # 创建立体声数据
            stereo_data = np.vstack((mixed_data, mixed_data)).T
        
        # 保存文件
        sf.write(output_path, stereo_data, vocal_sr)
        print(f"合并音频完成: {output_path}, 长度: {max_length/vocal_sr:.2f}秒")
        return True
    except Exception as e:
        print(f"合并音频失败: {str(e)}")
        return False