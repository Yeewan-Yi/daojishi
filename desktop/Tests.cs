using System;
using System.IO;
using Youqi;
class Tests {
 static int count;
 static void Check(bool value,string label) {if(!value)throw new Exception(label);count++;Console.WriteLine("PASS "+label);}
 static void Reject(string value) {try{Room.Parse(value);throw new Exception("Accepted invalid link");}catch(FormatException){count++;}}
 static void Main(string[] args) {
  string link="https://yeewan-yi.github.io/daojishi/#room=11111111-1111-1111-1111-111111111111&key="+new string('a',64);
  Room room=Room.Parse(link);Check(room.Url==link,"share link roundtrip");
  Reject(link.Replace("https:","http:"));Reject(link.Replace("yeewan-yi.github.io","evil.example"));Reject(link+"&key="+new string('b',64));Reject(link.Replace("/daojishi/","/other/"));Reject(link.Substring(0,link.Length-1));
  var record=new Record {Title="test",Start="2026-01-01T00:00:00Z",End="2026-01-02T00:00:00Z"};
  var start=record.StartTime;
  Check(record.Progress(start.AddHours(-1))==0,"progress clamps before start");Check(record.Progress(start.AddHours(12))==50,"halfway progress");Check(record.Progress(start.AddDays(2))==100,"progress clamps after end");
  Check(record.Remaining(start.AddHours(-1))==3600,"upcoming counts to start");Check(record.Remaining(start.AddMilliseconds(500))==86400,"remaining rounds up fractional second");Check(record.Remaining(start.AddDays(2))==0,"ended countdown stays zero");
  string json=Json.Encode(new {id=room.Id,version=1,can_edit=false,title="test",start=record.Start,end=record.End});
  Check(Record.Parse(json,room).Title=="test","RPC record validation");
  try {Record.Parse(json.Replace(room.Id,"22222222-2222-2222-2222-222222222222"),room);throw new Exception("Wrong room accepted");}catch(FormatException){count++;}
  var bytes=System.Text.Encoding.UTF8.GetBytes(link);var encrypted=System.Security.Cryptography.ProtectedData.Protect(bytes,null,System.Security.Cryptography.DataProtectionScope.CurrentUser);Check(System.Text.Encoding.UTF8.GetString(System.Security.Cryptography.ProtectedData.Unprotect(encrypted,null,System.Security.Cryptography.DataProtectionScope.CurrentUser))==link,"Windows encrypted storage roundtrip");
  if(args.Length>0 && args[0]=="--cloud") {try {var settings=Settings.Load();using(var cloud=new Cloud()){var live=cloud.Read(Room.Parse(settings.Link)).GetAwaiter().GetResult();Check(live.EndTime>live.StartTime,"existing shared countdown read (no writes)");}} catch(Exception ex) {Console.WriteLine("Cloud check failed: "+ex.GetType().Name+" "+ex.Message);Environment.Exit(1);}}
  Console.WriteLine(count+" checks passed");
  if(args.Length>1 && args[0]=="--render") RenderPreviews(args[1]);
 }
 static void RenderPreviews(string directory) {
  Directory.CreateDirectory(directory);
  var now=DateTimeOffset.Parse("2026-10-20T12:00:00Z");
  var sample=new Record {Title="下一次见面",Start="2026-09-14T07:00:00+08:00",End="2030-09-14T18:00:00+08:00"};
  foreach(bool dark in new[]{false,true}) foreach(float scale in new[]{300f/356,1f,1.25f,1.5f,2f}) {
   var bg=System.Drawing.ColorTranslator.FromHtml(dark?"#141917":"#f5f6f0");var ink=System.Drawing.ColorTranslator.FromHtml(dark?"#e5eae0":"#2b372d");var muted=System.Drawing.ColorTranslator.FromHtml(dark?"#8f9e93":"#738072");var accent=System.Drawing.ColorTranslator.FromHtml(dark?"#a3bc9a":"#5b7753");var track=System.Drawing.ColorTranslator.FromHtml(dark?"#28332b":"#dee5d7");
   using(var bitmap=new System.Drawing.Bitmap((int)Math.Round(356*scale),(int)Math.Round(176*scale)))using(var graphics=System.Drawing.Graphics.FromImage(bitmap)) {
    WidgetArt.Paint(graphics,bitmap.Size,bg,ink,muted,accent,track,sample,now,"已同步",true);
    for(int i=0;i<3;i++)WidgetArt.Action(graphics,System.Drawing.Rectangle.Round(new System.Drawing.RectangleF((228+i*38)*scale,10*scale,32*scale,32*scale)),i,muted,false,false,false);
    bitmap.Save(Path.Combine(directory,(dark?"dark-":"light-")+(int)(scale*100)+".png"),System.Drawing.Imaging.ImageFormat.Png);
   }
  }
  Console.WriteLine("Rendered light/dark at 100%, 125%, 150%, 200%.");
 }
}
