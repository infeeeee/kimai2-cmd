; Script generated by the Inno Script Studio Wizard.
; SEE THE DOCUMENTATION FOR DETAILS ON CREATING INNO SETUP SCRIPT FILES!

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
; (To generate a new GUID, click Tools | Generate GUID inside the IDE.)
AppId={{A10BF7B2-6641-4B06-9C68-268B649FCE57}
AppName=kimai2-cmd
AppVersion=1.4.0
AppPublisher=infeeeee
AppPublisherURL=https://github.com/infeeeee/kimai2-cmd
AppSupportURL=https://github.com/infeeeee/kimai2-cmd
AppUpdatesURL=https://github.com/infeeeee/kimai2-cmd
DefaultDirName={commonpf}\kimai2-cmd
DefaultGroupName=kimai2-cmd
AllowNoIcons=yes
LicenseFile={#SourcePath}\LICENSE
OutputDir={#SourcePath}\builds
OutputBaseFilename=kimai2-cmd-setup
SetupIconFile={#SourcePath}\assets\kimai-icon-192x192.ico
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "createini"; Description: "Create settings.ini during installation"; GroupDescription: "Server settings"; Flags: checkedonce

[Files]
Source: "builds\kimai2-cmd.exe"; DestDir: "{app}"; Flags: ignoreversion
; NOTE: Don't use "Flags: ignoreversion" on any shared system files
Source: "settings.ini.example"; DestDir: "{userappdata}\kimai2-cmd"; DestName: "settings.ini"; Flags: onlyifdoesntexist uninsneveruninstall recursesubdirs; Tasks: createini

[Icons]
Name: "{group}\kimai2-cmd"; Filename: "{app}\kimai2-cmd.exe"
Name: "{group}\{cm:UninstallProgram,kimai2-cmd}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\kimai2-cmd"; Filename: "{app}\kimai2-cmd.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\kimai2-cmd.exe"; Description: "{cm:LaunchProgram,kimai2-cmd}"; Flags: nowait postinstall skipifsilent

[INI]
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "serversettings"; Key: "kimaiurl"; String: "{code:GetKimaiUrl}"; Tasks: createini
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "serversettings"; Key: "username"; String: "{code:GetUserName}"; Tasks: createini
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "serversettings"; Key: "password"; String: "{code:GetPassword}"; Tasks: createini
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "serversettings"; Key: "servertime"; String: "false"; Tasks: createini
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "rainmeter"; Key: "skindir"; String: "{code:GetRainmeterPath}"; Tasks: createini
Filename: "{userappdata}\kimai2-cmd\settings.ini"; Section: "rainmeter"; Key: "meterstyle"; String: "styleProjects"; Tasks: createini

[Registry]
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
    ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; \
    Check: NeedsAddPath(ExpandConstant('{app}'))

[Code]
var AuthPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
AuthPage := CreateInputQueryPage(wpSelectTasks,
    'Kimai2 settings', 'Please enter your server url and account information',
    'You can modify this later in AppData\Roaming\kimai2-cmd\settings.ini');
  AuthPage.Add('Kimai2 url:', False);
  AuthPage.Add('Username:', False);
  AuthPage.Add('API password:', False);
  AuthPage.Add('Skin folder', False);
  AuthPage.Values[3] := ExpandConstant('{userdocs}') + '\Rainmeter\Skins\kimai2-cmd-rainmeter\kimai2';

end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  { Skip pages that shouldn't be shown }
  if (PageID = AuthPage.ID) and ( not WizardIsTaskSelected('createini')) then
    Result := True
  else
    Result := False;
end;


function AuthForm_NextButtonClick(Page: TWizardPage): Boolean;
begin
  Result := True;
end;

function GetKimaiUrl(Param: String): string;
begin
result := AuthPage.Values[0];
end;

function GetUserName(Param: String): string;
begin
result := AuthPage.Values[1];
end;

function GetPassword(Param: String): string;
begin
result := AuthPage.Values[2];
end;

function GetRainmeterPath(Param: String): string;
begin
result := AuthPage.Values[3];
end;

function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  { look for the path with leading and trailing semicolon }
  { Pos() returns 0 if not found }
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;
