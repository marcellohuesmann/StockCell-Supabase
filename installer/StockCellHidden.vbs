' StockCell - Launcher Silencioso
' Executa o servidor em segundo plano sem janela CMD visivel

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Define o diretorio do aplicativo
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = appDir & "\node\node.exe"
npmCliPath = appDir & "\node\node_modules\npm\bin\npm-cli.js"
serverPath = appDir & "\server.js"

' Verifica se o servidor ja esta rodando (evita duplicatas)
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE CommandLine LIKE '%server.js%' AND Name = 'node.exe'")
If colProcesses.Count > 0 Then
    MsgBox "StockCell ja esta em execucao!" & vbCrLf & vbCrLf & _
           "Acesse: http://localhost:3000", vbInformation, "StockCell"
    WScript.Quit
End If

' Configura o PATH para usar o Node.js embutido
env = WshShell.Environment("Process")
env("PATH") = appDir & "\node;" & env("PATH")

' Verifica se node_modules existe, senao instala (oculto)
If Not fso.FolderExists(appDir & "\node_modules\better-sqlite3") Then
    ' Instala dependencias em modo oculto
    exitCode = WshShell.Run("""" & nodePath & """ """ & npmCliPath & """ install --production", 0, True)
    If exitCode <> 0 Then
        MsgBox "Erro ao instalar dependencias." & vbCrLf & _
               "Execute StockCell.bat como Administrador para ver os detalhes.", _
               vbCritical, "StockCell - Erro"
        WScript.Quit
    End If
End If

' Verifica compatibilidade do modulo nativo (oculto)
exitCode = WshShell.Run("""" & nodePath & """ -e ""try{require('better-sqlite3')}catch(e){process.exit(1)}""", 0, True)
If exitCode <> 0 Then
    ' Rebuild do modulo nativo
    WshShell.Run """" & nodePath & """ """ & npmCliPath & """ rebuild better-sqlite3", 0, True
End If

' Inicia o servidor em modo oculto (0 = hidden)
WshShell.Run """" & nodePath & """ """ & serverPath & """", 0, False

' Aguarda 3 segundos e abre o navegador
WScript.Sleep 3000
WshShell.Run "http://localhost:3000", 1, False
