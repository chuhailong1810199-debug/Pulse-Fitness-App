const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
// Trước đây mọi file không phải .css đều gửi là text/html, nên <img src=".svg">
// và ảnh PNG đều hỏng khi test tại máy — trông y như lỗi sản phẩm.
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript',
 '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
http.createServer((q,s)=>{
  const f=path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
  fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end('nope');return;}
    s.writeHead(200,{'Content-Type': TYPES[path.extname(f).toLowerCase()]||'application/octet-stream'});
    s.end(d); });
}).listen(8777,()=>console.log('up on 8777'));
