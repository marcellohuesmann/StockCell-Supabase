' StockCell - Launcher Minimizado
' Executa o StockCell.bat mas mantem a janela minimizada na barra de tarefas

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Define o diretorio do aplicativo
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = appDir & "\StockCell.bat"

' Inicia o StockCell.bat minimizado (2 = Minimized, focus; 7 = Minimized, no focus)
' Usamos 7 para nao roubar o foco do usuario
WshShell.Run """" & batPath & """", 7, False

' Aguarda 4 segundos (tempo pro servidor subir) e abre o navegador
WScript.Sleep 4000
WshShell.Run "http://localhost:3000", 1, False
