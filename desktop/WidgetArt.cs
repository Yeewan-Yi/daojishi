using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Windows.Forms;

namespace Youqi {
// Drawn paths share the angular outline vocabulary of the user's 物归其位 project.
public sealed class IconButton : Button {
 readonly int kind;
 bool hover, down;
 public bool Active;
 public IconButton(int iconKind) {kind=iconKind;SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);FlatStyle=FlatStyle.Flat;FlatAppearance.BorderSize=0;}
 protected override void OnMouseEnter(EventArgs e){hover=true;Invalidate();base.OnMouseEnter(e);}
 protected override void OnMouseLeave(EventArgs e){hover=false;down=false;Invalidate();base.OnMouseLeave(e);}
 protected override void OnMouseDown(MouseEventArgs e){down=true;Invalidate();base.OnMouseDown(e);}
 protected override void OnMouseUp(MouseEventArgs e){down=false;Invalidate();base.OnMouseUp(e);}
 protected override void OnPaint(PaintEventArgs e){e.Graphics.Clear(BackColor);WidgetArt.Action(e.Graphics,ClientRectangle,kind,ForeColor,Active,hover||Focused,down);}
}
public static class WidgetArt {
 public static void Text(Graphics g,string text,string family,float size,Color color,RectangleF bounds,StringAlignment align) {
  using(var font=new Font(family,size,FontStyle.Regular,GraphicsUnit.Pixel))using(var brush=new SolidBrush(color))using(var format=new StringFormat(StringFormat.GenericTypographic) {Alignment=align,LineAlignment=StringAlignment.Center,Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap}) g.DrawString(text,font,brush,bounds,format);
 }
 public static void Diamond(Graphics g,Brush brush,float x,float y,float radius) {g.FillPolygon(brush,new[]{new PointF(x,y-radius),new PointF(x+radius,y),new PointF(x,y+radius),new PointF(x-radius,y)});}
 public static void Action(Graphics g,Rectangle bounds,int kind,Color color,bool active,bool hover,bool down) {
  var saved=g.Save();g.TranslateTransform(bounds.X,bounds.Y);g.ScaleTransform(bounds.Width/32f,bounds.Height/32f);g.SmoothingMode=SmoothingMode.AntiAlias;
  if(hover||active)using(var brush=new SolidBrush(Color.FromArgb(down?48:active?30:18,color)))g.FillPolygon(brush,new[]{new PointF(5,1),new PointF(27,1),new PointF(31,5),new PointF(31,27),new PointF(27,31),new PointF(5,31),new PointF(1,27),new PointF(1,5)});
  using(var pen=new Pen(color,1.35f))using(var brush=new SolidBrush(color)) {
   pen.LineJoin=LineJoin.Miter;
   if(kind==0) {
    var pinState=g.Save();if(!active){g.TranslateTransform(16,16);g.RotateTransform(28);g.TranslateTransform(-16,-16);}
    g.DrawLines(pen,new[]{new PointF(11,7),new PointF(21,7),new PointF(19,10),new PointF(19,15),new PointF(23,19),new PointF(9,19),new PointF(13,15),new PointF(13,10),new PointF(11,7)});
    g.DrawLine(pen,16,19,16,26);g.Restore(pinState);
    if(active)Diamond(g,brush,26,7,2);
   } else if(kind==1) {
    g.DrawPolygon(pen,new[]{new PointF(9,19),new PointF(20,8),new PointF(25,13),new PointF(14,24),new PointF(8,25)});
    g.DrawLine(pen,18,10,23,15);g.DrawLine(pen,9,19,14,24);g.DrawLine(pen,8,28,25,28);
   } else {Diamond(g,brush,8,16,1.9f);Diamond(g,brush,16,16,1.9f);Diamond(g,brush,24,16,1.9f);}
  }
  g.Restore(saved);
 }
 public static void Paint(Graphics g,Size size,Color background,Color ink,Color muted,Color accent,Color track,Record record,DateTimeOffset now,string state,bool connected) {
  var saved=g.Save();g.Clear(background);g.ScaleTransform(size.Width/356f,size.Height/176f);g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
  using(var pen=new Pen(Color.FromArgb(60,muted),1))using(var shape=Widget.Round(new RectangleF(.5f,.5f,355,175),14))g.DrawPath(pen,shape);
  using(var brush=new SolidBrush(connected?accent:Color.FromArgb(169,133,81)))Diamond(g,brush,24,26,2.5f);
  Text(g,record==null?"有期":record.Title,"Microsoft YaHei UI",13,ink,new RectangleF(36,13,184,26),StringAlignment.Near);
  using(var pen=new Pen(Color.FromArgb(45,muted),.8f))g.DrawLine(pen,20,48,336,48);
  if(record==null) Text(g,state,"Microsoft YaHei UI",14,muted,new RectangleF(20,65,316,52),StringAlignment.Center);
  else {
   long remaining=record.Remaining(now), days=remaining/86400;
   string dayText=days.ToString(CultureInfo.InvariantCulture);
   float daySize=dayText.Length>5?34:dayText.Length>4?40:48;
   Text(g,dayText,"Segoe UI",daySize,ink,new RectangleF(20,54,132,58),StringAlignment.Near);
   Text(g,"天","Microsoft YaHei UI",10,muted,new RectangleF(22,107,123,19),StringAlignment.Near);
   string[] digits={(remaining/3600%24).ToString("00"),(remaining/60%60).ToString("00"),(remaining%60).ToString("00")};
   string[] units={"时","分","秒"};
   for(int i=0;i<3;i++) {
    float x=167+i*60;
    Text(g,digits[i],"Segoe UI",28,ink,new RectangleF(x,66,49,39),StringAlignment.Center);
    Text(g,units[i],"Microsoft YaHei UI",10,muted,new RectangleF(x,107,49,19),StringAlignment.Center);
    if(i<2) {using(var brush=new SolidBrush(muted)){g.FillEllipse(brush,x+53,80,2,2);g.FillEllipse(brush,x+53,89,2,2);}}
   }
   double progress=record.Progress(now);var rect=new RectangleF(20,137,316,23);
   using(var brush=new SolidBrush(track))using(var path=Widget.Round(rect,5))g.FillPath(brush,path);
   if(progress>0) {var clip=g.Save();using(var path=Widget.Round(rect,5))g.SetClip(path);using(var brush=new SolidBrush(Color.FromArgb(86,accent)))g.FillRectangle(brush,rect.X,rect.Y,(float)(rect.Width*progress/100),rect.Height);g.Restore(clip);}
   Text(g,progress.ToString("F3",CultureInfo.InvariantCulture)+"%","Segoe UI",12,accent,rect,StringAlignment.Center);
  }
  g.Restore(saved);
 }
}
}
