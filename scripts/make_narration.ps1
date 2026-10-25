param()
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Huihui Desktop')
$s.Rate = -1
$s.SetOutputToWaveFile('E:\花开有声\_narration_lotus.wav')
$text = @'
清荷入梦，从一块石刻开始。它的原型，是都江堰市博物馆藏的荷花图拓片：一瓶，一荷，两侧圆叶，线条是凿出来的。
设计保留了瓶插的骨架。中央的荷花，仍在最高的位置；修长的瓶，仍是画面的底座；花、瓶口与瓶底，落在同一条中轴上。这是原型构图最安静的部分。
重组的是两侧的圆叶。原型里它们大小不一，设计稿把它们对称化，像花的一对耳饰，画面因此更稳。
配色取石刻的夜色：深藏青为底，花瓣留白偏蓝，圆叶用青绿，让纹样像在石面上自己发光。
实体花卡，是供印刷制作的平面设计稿。你在页面上看到的珠光，是这件设计在屏幕上的样子。
'@
$s.Speak([string]$text)
$s.Dispose()
Write-Output 'TTS done'
