' StockCell - Parar Servidor
' Encerra o servidor StockCell em execucao

Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE CommandLine LIKE '%server.js%' AND Name = 'node.exe'")

killed = 0
For Each objProcess In colProcesses
    objProcess.Terminate()
    killed = killed + 1
Next

If killed > 0 Then
    MsgBox "StockCell encerrado com sucesso.", vbInformation, "StockCell"
Else
    MsgBox "StockCell nao esta em execucao.", vbInformation, "StockCell"
End If
