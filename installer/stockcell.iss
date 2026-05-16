; ====================================================
; StockCell - Instalador Inno Setup
; Sistema de Gestao de Vendas e Estoque
; ====================================================

#define MyAppName "StockCell"
#define MyAppVersion "1.0.52"
#define MyAppPublisher "Marcello"
#define MyAppURL "https://github.com/Marcello"
#define MyAppExeName "StockCell.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName=C:\StockCell
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=StockCell_Setup_v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
SetupIconFile=stockcell.ico
UninstallDisplayIcon={app}\stockcell.ico

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na &Area de Trabalho"; GroupDescription: "Atalhos:"
Name: "startupicon"; Description: "Iniciar automaticamente com o Windows"; GroupDescription: "Opcoes:"

[Files]
; Codigo-fonte do aplicativo
Source: "..\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Manual_do_Usuario.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\md\*"; DestDir: "{app}\md"; Flags: ignoreversion recursesubdirs createallsubdirs

; Node.js portatil embutido
Source: "node-portable\node-v22.15.0-win-x64\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Scripts de inicializacao
Source: "StockCell.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "StockCellMinimized.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "StockCellStop.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "stockcell.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\StockCellMinimized.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\stockcell.ico"; Comment: "Iniciar StockCell (minimizado)"
Name: "{group}\{#MyAppName} (Console)"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\stockcell.ico"; Comment: "Iniciar StockCell com janela de console"
Name: "{group}\Parar {#MyAppName}"; Filename: "{app}\StockCellStop.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\stockcell.ico"; Comment: "Encerrar o servidor StockCell"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\StockCellMinimized.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\stockcell.ico"; Tasks: desktopicon; Comment: "Iniciar StockCell"
Name: "{commonstartup}\{#MyAppName}"; Filename: "{app}\StockCellMinimized.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\stockcell.ico"; Tasks: startupicon

[Dirs]
Name: "{app}\data"; Permissions: users-full
Name: "{app}\data\backups"; Permissions: users-full
Name: "{app}\public\uploads"; Permissions: users-full

[Run]
Filename: "{app}\node\node.exe"; Parameters: "-e ""console.log('Node.js OK: ' + process.version)"""; WorkingDir: "{app}"; StatusMsg: "Verificando Node.js embutido..."; Flags: runhidden waituntilterminated
Filename: "{app}\StockCellMinimized.vbs"; Description: "Iniciar {#MyAppName} agora"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent shellexec

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\data"

[Code]
// Verifica se a porta 3000 esta em uso
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // Cria regra de firewall para permitir conexões na rede local
    Exec(ExpandConstant('{sys}\netsh.exe'),
      'advfirewall firewall add rule name="StockCell Server" dir=in action=allow protocol=TCP localport=3000',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    // Remove regra de firewall
    Exec(ExpandConstant('{sys}\netsh.exe'),
      'advfirewall firewall delete rule name="StockCell Server"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
