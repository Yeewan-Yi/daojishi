using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Youqi {
public sealed class Settings {
 public string Link = "";
 public string Theme = "system";
 public bool Pinned;
 public string SizeMode = "compact";
 public int X = int.MinValue, Y;
 public Record Cache;
 public static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YouqiWidget");
 public static string FilePath { get { return Path.Combine(DirectoryPath, "settings.dat"); } }
 public static Settings Load() { try { return Json.Decode<Settings>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(FilePath), null, DataProtectionScope.CurrentUser))) ?? new Settings(); } catch { return new Settings(); } }
 public void Save() {
  Directory.CreateDirectory(DirectoryPath);
  byte[] data = ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Encode(this)), null, DataProtectionScope.CurrentUser);
  string temp = FilePath + ".tmp"; File.WriteAllBytes(temp, data);
  if (File.Exists(FilePath)) File.Replace(temp, FilePath, null); else File.Move(temp, FilePath);
 }
}
public static class Json {
 public static string Encode(object value) { return new JavaScriptSerializer().Serialize(value); }
 public static T Decode<T>(string value) { return new JavaScriptSerializer().Deserialize<T>(value); }
}
public sealed class Room {
 public string Id, Token;
 public static Room Parse(string link) {
  Uri uri;
  if (!Uri.TryCreate(link.Trim(), UriKind.Absolute, out uri) || uri.Scheme != "https" || uri.Host != "yeewan-yi.github.io" || !uri.IsDefaultPort || uri.AbsolutePath != "/daojishi/" || uri.UserInfo.Length != 0) throw new FormatException("请粘贴“有期”网页分享按钮生成的完整链接。");
  var values = new Dictionary<string,string>();
  foreach (string pair in uri.Fragment.TrimStart('#').Split('&')) { var bits = pair.Split(new char[]{'='},2); if(bits.Length == 2) { if(values.ContainsKey(bits[0])) throw new FormatException("共享链接包含重复参数。"); values.Add(bits[0], Uri.UnescapeDataString(bits[1])); } }
  string id, token;
  if(!values.TryGetValue("room", out id) || !values.TryGetValue("key", out token) || !Regex.IsMatch(id, @"\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\z") || !Regex.IsMatch(token, @"\A[0-9a-f]{64}\z")) throw new FormatException("链接不完整，请在网页中重新复制共享链接。");
  return new Room {Id=id.ToLowerInvariant(),Token=token};
 }
 public string Url { get { return "https://yeewan-yi.github.io/daojishi/#room=" + Id + "&key=" + Token; } }
}
public sealed class Record {
 public string Title, Start, End;
 public DateTimeOffset StartTime { get { return DateTimeOffset.Parse(Start, CultureInfo.InvariantCulture); } }
 public DateTimeOffset EndTime { get { return DateTimeOffset.Parse(End, CultureInfo.InvariantCulture); } }
 public static Record Parse(string json, Room room) {
  var row=Json.Decode<Dictionary<string,object>>(json);
  if(row == null || !row.ContainsKey("id") || !String.Equals(Convert.ToString(row["id"]), room.Id, StringComparison.OrdinalIgnoreCase) || !row.ContainsKey("version") || Convert.ToInt64(row["version"]) < 1 || !row.ContainsKey("can_edit") || !(row["can_edit"] is bool)) throw new FormatException("云端返回了无效记录。");
  var result = new Record {Title=Convert.ToString(row["title"]), Start=Convert.ToString(row["start"]), End=Convert.ToString(row["end"])};
  if(String.IsNullOrWhiteSpace(result.Title) || result.Title.Length>80 || result.EndTime<=result.StartTime) throw new FormatException("云端标题或时间无效。");
  return result;
 }
 public double Progress(DateTimeOffset now) { return Math.Max(0,Math.Min(100,(now-StartTime).TotalSeconds/(EndTime-StartTime).TotalSeconds*100)); }
 public long Remaining(DateTimeOffset now) { return (long)Math.Max(0, Math.Ceiling(((now < StartTime ? StartTime : EndTime)-now).TotalSeconds)); }
}
public sealed class Cloud : IDisposable {
 readonly HttpClient http = new HttpClient { Timeout=TimeSpan.FromSeconds(12) };
 public Cloud() { System.Net.ServicePointManager.SecurityProtocol=System.Net.SecurityProtocolType.Tls12; http.DefaultRequestHeaders.Add("apikey", "sb_publishable_Yjnz4aqw3A5i7_HwVZ7rAA_2k2Nk-pM"); }
 public async Task<Record> Read(Room room) {
  using(var body=new StringContent(Json.Encode(new {p_id=room.Id,p_token=room.Token}),Encoding.UTF8,"application/json"))
  using(var response=await http.PostAsync("https://qwyifoigjmvttxvgwnns.supabase.co/rest/v1/rpc/youqi_read",body)) {
   if(!response.IsSuccessStatusCode) { if((int)response.StatusCode==401 || (int)response.StatusCode==403) throw new InvalidOperationException("共享链接失效或没有访问权限。"); throw new InvalidOperationException("暂时无法同步，请稍后重试或检查共享链接。"); }
   return Record.Parse(await response.Content.ReadAsStringAsync(),room);
  }
 }
 public void Dispose() { http.Dispose(); }
}
public static class Program {
 [STAThread] public static void Main(string[] args) {
  System.Net.ServicePointManager.SecurityProtocol=System.Net.SecurityProtocolType.Tls12;
  if(args.Length>0 && args[0]=="--import-stdin") { var s=Settings.Load(); s.Link=Room.Parse(Console.In.ReadToEnd()).Url; s.Cache=null; s.Save(); return; }
  Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
  bool created;
  using(var mutex=new Mutex(true,"Local\\YouqiWidget",out created)) {
   if(!created) { MessageBox.Show("有期已在运行，请在任务栏右下角托盘中打开。","有期"); return; }
   Application.Run(new Widget());
  }
 }
}
public sealed class Widget : Form {
 readonly Settings settings=Settings.Load();
 readonly Cloud cloud=new Cloud();
 readonly System.Windows.Forms.Timer tick=new System.Windows.Forms.Timer {Interval=1000};
 readonly System.Windows.Forms.Timer sync=new System.Windows.Forms.Timer {Interval=8000};
 readonly NotifyIcon tray=new NotifyIcon();
 readonly ContextMenuStrip menu=new ContextMenuStrip();
 readonly ToolTip tips=new ToolTip();
 IconButton pin, edit, more;
 ToolStripMenuItem pinned, startup;
 bool busy, connecting, quitting, connected;
 string state="正在同步";
 string lastTip="";
 Record record;
 Color ink, muted, accent, track;
 [DllImport("user32.dll")] static extern bool ReleaseCapture();
 [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 public Widget() {
  Text="有期 · 桌面倒计时"; AccessibleName=Text; FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false;
  AutoScaleMode=AutoScaleMode.None; ClientSize=SelectedWindowSize(); DoubleBuffered=true; Font=new Font("Microsoft YaHei UI",9);
  StartPosition=FormStartPosition.Manual;
  Rectangle area=Screen.PrimaryScreen.WorkingArea;
  Location=settings.X==int.MinValue ? new Point(area.Right-ClientSize.Width-28,area.Top+36) : new Point(settings.X,settings.Y);
  EnsureVisible(); TopMost=settings.Pinned; record=settings.Cache;
  pin=MakeButton("置顶",0,TogglePin);
  edit=MakeButton("编辑",1,OpenEditor);
  more=MakeButton("更多",2,delegate { menu.Show(more,new Point(0,more.Height)); });
  tips.SetToolTip(pin,"切换始终置顶"); tips.SetToolTip(edit,"在浏览器中打开完整界面"); tips.SetToolTip(more,"更多设置 / 隐藏 / 退出");
  menu.Items.Add("显示小组件",null,delegate { Show(); EnsureVisible(); Activate(); });
  menu.Items.Add("打开完整界面",null,delegate { OpenEditor(); });
  pinned=new ToolStripMenuItem("始终置顶",null,delegate { TogglePin(); }); menu.Items.Add(pinned);
  menu.Items.Add("更换共享链接…",null,async delegate { await Connect(); });
  var theme=new ToolStripMenuItem("外观");
  foreach(string name in new[]{"跟随系统","浅色","深色"}) { string mode=name=="浅色"?"light":name=="深色"?"dark":"system"; theme.DropDownItems.Add(name,null,delegate {settings.Theme=mode; Persist(); ApplyTheme();}); }
  menu.Items.Add(theme);
  var sizes=new ToolStripMenuItem("小窗尺寸");
  foreach(string name in new[]{"精简","标准","大号"}) {string mode=name=="精简"?"compact":name=="标准"?"normal":"large";var item=new ToolStripMenuItem(name,null,delegate {settings.SizeMode=mode;ClientSize=SelectedWindowSize();LayoutActions();UpdateRegion();EnsureVisible();Persist();});sizes.DropDownItems.Add(item);sizes.DropDownOpening+=delegate {item.Checked=settings.SizeMode==mode;};}
  menu.Items.Add(sizes);
  startup=new ToolStripMenuItem("开机启动",null,delegate { ToggleStartup(); }); menu.Items.Add(startup);
  menu.Items.Add("立即同步",null,async delegate { await RefreshCloud(); });
  menu.Items.Add("隐藏到托盘",null,delegate { Persist(); Hide(); }); menu.Items.Add(new ToolStripSeparator());
  menu.Items.Add("退出",null,delegate { quitting=true; Close(); });
  menu.Opening+=delegate {pinned.Checked=TopMost; startup.Checked=IsStartup();};
  tray.Text="有期 · 桌面倒计时"; tray.Icon=CreateIcon(); Icon=tray.Icon; tray.ContextMenuStrip=menu; tray.Visible=true;
  tray.DoubleClick+=delegate {Show();EnsureVisible();Activate();};
  MouseDown+=delegate(object sender, MouseEventArgs e) {if(e.Button==MouseButtons.Left) {ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);} else if(e.Button==MouseButtons.Right) menu.Show(this,e.Location);};
  Move+=delegate {if(IsHandleCreated && Visible){settings.X=Left;settings.Y=Top;}};
  Resize+=delegate { LayoutActions(); UpdateRegion(); };
  tick.Tick+=delegate {ApplyTheme();Invalidate();}; sync.Tick+=async delegate {await RefreshCloud();};
  ApplyTheme();
  Shown+=async delegate { EnsureVisible(); UpdateRegion(); tick.Start();sync.Start(); if(String.IsNullOrEmpty(settings.Link)) await Connect(); else await RefreshCloud();};
  FormClosing+=delegate(object sender,FormClosingEventArgs e) {if(!quitting && e.CloseReason==CloseReason.UserClosing) {e.Cancel=true;Persist();Hide();} else {Persist();tick.Stop();sync.Stop();tray.Visible=false;}};
 }
 IconButton MakeButton(string name,int kind,Action action) {var b=new IconButton(kind) {AccessibleName=name,TabStop=true,Cursor=Cursors.Hand};b.Click+=delegate {action();};Controls.Add(b);return b;}
 void LayoutActions() {if(pin==null || more==null)return;float scale=ClientSize.Width/356f;pin.Bounds=Rectangle.Round(new RectangleF(228*scale,10*scale,32*scale,32*scale));edit.Bounds=Rectangle.Round(new RectangleF(266*scale,10*scale,32*scale,32*scale));more.Bounds=Rectangle.Round(new RectangleF(304*scale,10*scale,32*scale,32*scale));}
 void UpdateRegion() {if(ClientSize.Width<1)return;using(var path=Round(new RectangleF(0,0,ClientSize.Width,ClientSize.Height),14*ClientSize.Width/356f)){var old=Region;Region=new Region(path);if(old!=null)old.Dispose();}}
 Size SelectedWindowSize() {int width=settings.SizeMode=="large"?428:settings.SizeMode=="normal"?356:300;return new Size(width,(int)Math.Round(width*176.0/356));}
 protected override void OnHandleCreated(EventArgs e) {base.OnHandleCreated(e);ClientSize=SelectedWindowSize();LayoutActions();UpdateRegion();EnsureVisible();}
 void Persist() {try {settings.Save();} catch {state="设置暂未保存";} }
 void EnsureVisible() {var bounds=Screen.FromPoint(Location).WorkingArea; Location=new Point(Math.Max(bounds.Left,Math.Min(Left,bounds.Right-Width)),Math.Max(bounds.Top,Math.Min(Top,bounds.Bottom-Height)));}
 void TogglePin() {TopMost=!TopMost;settings.Pinned=TopMost;pin.Active=TopMost;pin.AccessibleName=TopMost?"取消置顶":"置顶";tips.SetToolTip(pin,TopMost?"取消置顶":"始终置顶");Persist();pin.Invalidate();Invalidate();}
 void OpenEditor() {if(String.IsNullOrEmpty(settings.Link)) {var unused=Connect();return;} try {System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Room.Parse(settings.Link).Url) {UseShellExecute=true});} catch {MessageBox.Show(this,"无法打开浏览器，请检查默认浏览器设置。","有期");}}
 bool IsStartup() {using(var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) {return key!=null && Convert.ToString(key.GetValue("YouqiWidget"))=="\""+Application.ExecutablePath+"\"";}}
 void ToggleStartup() {try {using(var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) {if(IsStartup()) key.DeleteValue("YouqiWidget",false); else key.SetValue("YouqiWidget","\""+Application.ExecutablePath+"\"");}} catch {MessageBox.Show(this,"开机启动设置未保存。","有期");}}
 async Task Connect() {
  if(connecting) return;
  connecting=true;
  try {
  using(var dialog=new Form {Text="连接共享倒计时",ClientSize=new Size(460,168),StartPosition=FormStartPosition.CenterParent,FormBorderStyle=FormBorderStyle.FixedDialog,MinimizeBox=false,MaximizeBox=false,ShowInTaskbar=false,Font=Font}) {
   var label=new Label {Text="粘贴网页“分享”中复制的完整链接",AutoSize=true,Location=new Point(20,18)};
   var input=new TextBox {Bounds=new Rectangle(20,50,420,30),AccessibleName="共享链接",UseSystemPasswordChar=true};
   var ok=new Button {Text="连接",Bounds=new Rectangle(340,112,100,32),DialogResult=DialogResult.OK};
   var cancel=new Button {Text="取消",Bounds=new Rectangle(230,112,100,32),DialogResult=DialogResult.Cancel};
   dialog.Controls.AddRange(new Control[]{label,input,ok,cancel});dialog.AcceptButton=ok;dialog.CancelButton=cancel;
   if(dialog.ShowDialog(this)!=DialogResult.OK) {if(record==null) state="请连接共享倒计时";Invalidate();return;}
   try {
    Room candidate=Room.Parse(input.Text); ok.Enabled=false;
    state="正在连接";Invalidate();
    // Validate before replacing the existing room or its offline cache.
    Record next=await cloud.Read(candidate);
    settings.Link=candidate.Url;settings.Cache=next;record=next;connected=true;state="已同步";Persist();Invalidate();
   } catch(Exception ex) {state=record==null?"连接失败":"使用上次同步数据";MessageBox.Show(this,ex is FormatException||ex is InvalidOperationException?ex.Message:"连接失败，请检查网络后重试。","有期");Invalidate();}
  }
  } finally {connecting=false;}
 }
 async Task RefreshCloud() {
  if(busy || String.IsNullOrEmpty(settings.Link) || IsDisposed) return;
  busy=true;string requested=settings.Link;
  try {var next=await cloud.Read(Room.Parse(requested));if(IsDisposed || requested!=settings.Link)return;record=next;connected=true;state="已同步";if(Json.Encode(settings.Cache)!=Json.Encode(next)) {settings.Cache=next;Persist();}}
  catch {if(!IsDisposed && requested==settings.Link){connected=false;state=record==null?"同步失败 · 检查网络或链接":"离线 · 使用上次同步数据";}}
  finally {busy=false;if(!IsDisposed)Invalidate();}
 }
 void ApplyTheme() {
  bool dark=settings.Theme=="dark";
  if(settings.Theme=="system") {try {dark=Convert.ToInt32(Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize","AppsUseLightTheme",1))==0;}catch{}}
  Color bg=dark?Color.FromArgb(20,25,23):Color.FromArgb(245,246,240);
  if(BackColor==bg)return;
  BackColor=bg;ink=dark?Color.FromArgb(229,234,224):Color.FromArgb(43,55,45);muted=dark?Color.FromArgb(143,158,147):Color.FromArgb(115,128,114);accent=dark?Color.FromArgb(163,188,154):Color.FromArgb(91,119,83);track=dark?Color.FromArgb(40,51,43):Color.FromArgb(222,229,215);
  foreach(Control c in Controls) {c.BackColor=bg;c.ForeColor=muted;} menu.BackColor=bg;menu.ForeColor=ink;
  pin.Active=TopMost;pin.Invalidate();Invalidate();
 }
 public static GraphicsPath Round(RectangleF r,float radius) {var p=new GraphicsPath();float d=radius*2;p.AddArc(r.X,r.Y,d,d,180,90);p.AddArc(r.Right-d,r.Y,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.X,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
 protected override void OnPaint(PaintEventArgs e) {
  base.OnPaint(e);var now=DateTimeOffset.Now;
  WidgetArt.Paint(e.Graphics,ClientSize,BackColor,ink,muted,accent,track,record,now,state,connected);
  string nextTip=(record==null?"有期":record.Title)+" · "+state;
  if(nextTip!=lastTip){lastTip=nextTip;tips.SetToolTip(this,nextTip);}
  AccessibleDescription=record==null?state:record.Title+"，剩余 "+record.Remaining(now)+" 秒，进度 "+record.Progress(now).ToString("F3")+"%，"+state;
 }
 static Icon CreateIcon() {using(var bitmap=new Bitmap(32,32))using(var g=Graphics.FromImage(bitmap)){g.SmoothingMode=SmoothingMode.AntiAlias;g.Clear(Color.Transparent);using(var b=new SolidBrush(Color.FromArgb(91,119,83)))g.FillEllipse(b,1,1,30,30);using(var p=new Pen(Color.White,2)){g.DrawEllipse(p,8,8,16,16);g.DrawLine(p,16,11,16,16);g.DrawLine(p,16,16,20,18);}IntPtr h=bitmap.GetHicon();try{return (Icon)Icon.FromHandle(h).Clone();}finally{DestroyIcon(h);}}}
 [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
 protected override void WndProc(ref Message message) {base.WndProc(ref message);if(message.Msg==0x02E0){ClientSize=SelectedWindowSize();LayoutActions();UpdateRegion();EnsureVisible();}if(message.Msg==0x232){settings.X=Left;settings.Y=Top;Persist();}}
 protected override void Dispose(bool disposing) {if(disposing){tick.Dispose();sync.Dispose();tray.Dispose();menu.Dispose();tips.Dispose();cloud.Dispose();}base.Dispose(disposing);}
}
}
