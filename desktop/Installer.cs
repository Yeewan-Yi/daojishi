using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

class Installer {
 [STAThread] static void Main() {
  Application.EnableVisualStyles();
  string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","YouqiWidget");
  string executable=Path.Combine(directory,"YouqiWidget.exe");
  using(var dialog=new Form {Text="安装有期桌面小组件",ClientSize=new System.Drawing.Size(420,220),FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false,StartPosition=FormStartPosition.CenterScreen,Font=new System.Drawing.Font("Microsoft YaHei UI",9)}) {
   var title=new Label {Text="有期 · 桌面倒计时",Font=new System.Drawing.Font("Microsoft YaHei UI",16),AutoSize=true,Left=24,Top=24};
   var detail=new Label {Text="轻巧常驻，与你的共享倒计时同步。\n安装到当前用户，无需管理员权限。",AutoSize=true,Left=25,Top=76};
   var shortcut=new CheckBox {Text="创建桌面快捷方式",Checked=true,AutoSize=true,Left=25,Top=132};
   var button=new Button {Text="安装并打开",Left=270,Top=168,Width=125,Height=32};
   button.Click+=delegate {
    button.Enabled=false;
    try {
     foreach(var process in Process.GetProcessesByName("YouqiWidget")) {process.Dispose();throw new IOException("请先从托盘退出正在运行的有期，再安装。\n已保存的设置会保留。");}
     Directory.CreateDirectory(directory);
     using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("Widget"))using(var output=File.Create(executable)) input.CopyTo(output);
     string programs=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"有期");Directory.CreateDirectory(programs);
     CreateShortcut(Path.Combine(programs,"有期.lnk"),executable);
     if(shortcut.Checked) CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"有期.lnk"),executable);
     File.WriteAllText(Path.Combine(directory,"卸载说明.txt"),"从托盘退出有期，关闭开机启动后，删除本文件夹及桌面、开始菜单中的有期快捷方式即可。\r\n个人设置位于 %LOCALAPPDATA%\\YouqiWidget，保留此目录可保留共享链接与设置。\r\n");
     Process.Start(new ProcessStartInfo(executable) {UseShellExecute=true});dialog.Close();
    } catch(Exception ex) {MessageBox.Show(dialog,ex.Message,"安装未完成");button.Enabled=true;}
   };
   dialog.Controls.AddRange(new Control[]{title,detail,shortcut,button});dialog.AcceptButton=button;Application.Run(dialog);
  }
 }
 static void CreateShortcut(string path,string executable) {
  object shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
  object shortcut=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});
  try {shortcut.GetType().InvokeMember("TargetPath",BindingFlags.SetProperty,null,shortcut,new object[]{executable});shortcut.GetType().InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,shortcut,new object[]{Path.GetDirectoryName(executable)});shortcut.GetType().InvokeMember("Save",BindingFlags.InvokeMethod,null,shortcut,null);}
  finally {System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shortcut);System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);}
 }
}
