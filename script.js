// ══════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

// ══════════════════════════════════════
// BG REMOVER
// ══════════════════════════════════════
let originalFile = null, resultCanvas = null, sliderX = 50, isDragging = false;
const fileInput  = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');

fileInput.addEventListener('change', e => { if (e.target.files[0]) processImage(e.target.files[0]); });
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) processImage(f);
});

async function processImage(file) {
  if (file.size > 10*1024*1024) { alert('File must be under 10MB.'); return; }
  originalFile = file;
  document.getElementById('upload-section').style.display = 'none';
  document.getElementById('processing-card').style.display = 'block';
  document.getElementById('result-section').style.display = 'none';
  const img = await loadImage(file);
  const steps = [
    {p:15,t:'Analyzing image…'},{p:35,t:'Detecting subject…'},
    {p:60,t:'Segmenting edges…'},{p:80,t:'Refining mask…'},
    {p:95,t:'Finalizing output…'},{p:100,t:'Done!'}
  ];
  for (const s of steps) {
    await new Promise(r => setTimeout(r, 400 + Math.random()*300));
    document.getElementById('progress-bar').style.width = s.p+'%';
    document.getElementById('progress-label').textContent = s.p+'%';
    document.getElementById('status-text').textContent = s.t;
  }
  await new Promise(r => setTimeout(r, 300));
  removeBackground(img);
}

function loadImage(file) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = e => { const i = new Image(); i.onload = () => res(i); i.src = e.target.result; };
    fr.readAsDataURL(file);
  });
}

function removeBackground(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0,0,c.width,c.height);
  const d = id.data, w = c.width, h = c.height;
  const bg = sampleBg(d,w,h);
  const mask = buildMask(d,w,h,bg);
  for (let i=0;i<w*h;i++) d[i*4+3] = mask[i];
  ctx.putImageData(id,0,0);
  resultCanvas = c;
  const resultSrc = c.toDataURL('image/png');
  document.getElementById('processing-card').style.display = 'none';
  document.getElementById('img-original').src = img.src;
  document.getElementById('img-result').src = resultSrc;
  document.getElementById('result-section').style.display = 'block';
  document.getElementById('download-btn').onclick = () => dl(resultSrc,'clearcut-result.png');
  initSlider();
}

function sampleBg(d,w,h){
  const pts=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[w>>1,0],[0,h>>1],[w-1,h>>1],[w>>1,h-1]];
  let r=0,g=0,b=0;
  for(const[x,y]of pts){const i=(y*w+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2];}
  return[r/pts.length,g/pts.length,b/pts.length];
}

function dist(r1,g1,b1,r2,g2,b2){return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2);}

function buildMask(d,w,h,bg){
  const mask=new Uint8Array(w*h),vis=new Uint8Array(w*h),q=[],T=60;
  const seed=(x,y)=>{
    const idx=y*w+x; if(vis[idx])return;
    const i=idx*4;
    if(dist(d[i],d[i+1],d[i+2],bg[0],bg[1],bg[2])<T){vis[idx]=1;mask[idx]=0;q.push([x,y]);}
  };
  for(let x=0;x<w;x++){seed(x,0);seed(x,h-1);}
  for(let y=0;y<h;y++){seed(0,y);seed(w-1,y);}
  const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
  while(q.length){
    const[x,y]=q.shift();
    for(const[dx,dy]of dirs){
      const nx=x+dx,ny=y+dy;
      if(nx<0||nx>=w||ny<0||ny>=h)continue;
      const idx=ny*w+nx; if(vis[idx])continue;
      const i=idx*4;
      if(dist(d[i],d[i+1],d[i+2],bg[0],bg[1],bg[2])<T){vis[idx]=1;mask[idx]=0;q.push([nx,ny]);}
    }
  }
  for(let i=0;i<w*h;i++) if(!vis[i])mask[i]=255;
  const s=new Uint8Array(w*h),r=2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let sum=0,cnt=0;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx>=0&&nx<w&&ny>=0&&ny<h){sum+=mask[ny*w+nx];cnt++;}
    }
    s[y*w+x]=Math.round(sum/cnt);
  }
  return s;
}

function resetBgRemover(){
  document.getElementById('result-section').style.display='none';
  const us=document.getElementById('upload-section');
  us.style.display='block'; us.style.opacity='1';
  fileInput.value=''; originalFile=null; resultCanvas=null;
  sliderX=50; updateSlider(50);
}

function initSlider(){
  const w=document.getElementById('compare-wrapper');
  updateSlider(50);
  w.addEventListener('mousedown',e=>{isDragging=true;onDrag(e);});
  w.addEventListener('touchstart',e=>{isDragging=true;onDragT(e);},{passive:true});
}
document.addEventListener('mousemove',onDrag);
document.addEventListener('touchmove',e=>{if(isDragging)onDragT(e);},{passive:true});
document.addEventListener('mouseup',()=>isDragging=false);
document.addEventListener('touchend',()=>isDragging=false);

function onDrag(e){
  if(!isDragging)return;
  const r=document.getElementById('compare-wrapper').getBoundingClientRect();
  updateSlider(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
}
function onDragT(e){
  const r=document.getElementById('compare-wrapper').getBoundingClientRect();
  updateSlider(Math.max(0,Math.min(100,((e.touches[0].clientX-r.left)/r.width)*100)));
}
function updateSlider(p){
  sliderX=p;
  document.getElementById('img-original').style.clipPath=`inset(0 ${100-p}% 0 0)`;
  document.getElementById('divider-line').style.left=p+'%';
  document.getElementById('divider-handle').style.left=p+'%';
}

function setBg(color,el){
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  const w=document.getElementById('compare-wrapper');
  if(color==='transparent'){w.style.background='';w.className='compare-wrapper compare-bg';}
  else{w.className='compare-wrapper';w.style.background=color;}
}
function setCustomColor(hex){
  const w=document.getElementById('compare-wrapper');
  w.className='compare-wrapper'; w.style.background=hex;
}

// ══════════════════════════════════════
// FORMAT CONVERTER
// ══════════════════════════════════════
let convFile=null, convImgEl=null, selectedFmt='png', convQuality=0.92;

const convFileInput=document.getElementById('conv-file-input');
const convZone=document.getElementById('conv-upload-zone');

convFileInput.addEventListener('change',e=>{if(e.target.files[0])loadConvFile(e.target.files[0]);});
convZone.addEventListener('dragover',e=>{e.preventDefault();convZone.classList.add('drag-over');});
convZone.addEventListener('dragleave',()=>convZone.classList.remove('drag-over'));
convZone.addEventListener('drop',e=>{
  e.preventDefault();convZone.classList.remove('drag-over');
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/'))loadConvFile(f);
});

function loadConvFile(file){
  convFile=file;
  const fr=new FileReader();
  fr.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      convImgEl=img;
      const ext=file.name.split('.').pop().toLowerCase();
      const nm={'jpg':'JPEG','jpeg':'JPEG','png':'PNG','webp':'WEBP','gif':'GIF','bmp':'BMP'};
      document.getElementById('from-format-display').textContent=
        (nm[ext]||ext.toUpperCase())+' · '+img.width+'×'+img.height+'px · '+formatBytes(file.size);
      document.getElementById('conv-thumb').src=e.target.result;
      document.getElementById('conv-file-name').textContent=file.name;
      document.getElementById('conv-file-details').textContent=
        img.width+'×'+img.height+' px  ·  '+formatBytes(file.size);
      document.getElementById('conv-file-bar').style.display='flex';
      updateChipsForSource(ext);
      document.getElementById('btn-convert').disabled=false;
      document.getElementById('conv-result').style.display='none';
    };
    img.src=e.target.result;
  };
  fr.readAsDataURL(file);
}

function updateChipsForSource(ext){
  const srcNorm=ext==='jpg'?'jpeg':ext;
  document.querySelectorAll('.format-chip').forEach(c=>{
    const same=c.dataset.fmt===srcNorm;
    c.classList.toggle('disabled',same);
    if(same&&c.classList.contains('selected')){
      c.classList.remove('selected');
      const first=[...document.querySelectorAll('.format-chip')].find(x=>x.dataset.fmt!==srcNorm);
      if(first){first.classList.add('selected');selectedFmt=first.dataset.fmt;}
    }
  });
}

function selectFormat(chip){
  document.querySelectorAll('.format-chip').forEach(c=>c.classList.remove('selected'));
  chip.classList.add('selected');
  selectedFmt=chip.dataset.fmt;
}

function updateQuality(v){ convQuality=v/100; document.getElementById('quality-val').textContent=v+'%'; }

function convertImage(){
  if(!convImgEl)return;
  const c=document.createElement('canvas');
  c.width=convImgEl.width; c.height=convImgEl.height;
  const ctx=c.getContext('2d');
  if(selectedFmt==='jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);}
  ctx.drawImage(convImgEl,0,0);
  const mime=selectedFmt==='jpeg'?'image/jpeg':selectedFmt==='webp'?'image/webp':selectedFmt==='bmp'?'image/bmp':'image/png';
  const q=(selectedFmt==='jpeg'||selectedFmt==='webp')?convQuality:undefined;
  const url=c.toDataURL(mime,q);
  const outBytes=Math.round((url.split(',')[1].length*3)/4);
  const inBytes=convFile.size;
  const diff=outBytes-inBytes;
  const pct=Math.round(Math.abs(diff)/inBytes*100);
  document.getElementById('conv-preview-img').src=url;
  document.getElementById('orig-size-val').textContent=formatBytes(inBytes);
  document.getElementById('conv-size-val').textContent=formatBytes(outBytes);
  const sv=document.getElementById('savings-val');
  if(diff<0){sv.textContent='−'+pct+'% smaller';sv.className='size-stat-val smaller';}
  else if(diff>0){sv.textContent='+'+pct+'% larger';sv.className='size-stat-val larger';}
  else{sv.textContent='Same size';sv.className='size-stat-val neutral';}
  const ext=selectedFmt==='jpeg'?'jpg':selectedFmt;
  const base=convFile.name.replace(/\.[^.]+$/,'');
  document.getElementById('conv-result-label').textContent='Converted to '+selectedFmt.toUpperCase()+'!';
  document.getElementById('conv-download-btn').onclick=()=>dl(url,base+'.'+ext);
  const res=document.getElementById('conv-result');
  res.style.display='block';
  res.style.animation='fadeUp .4s ease forwards';
  res.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function resetConverter(){
  convFile=null; convImgEl=null; convFileInput.value='';
  document.getElementById('conv-file-bar').style.display='none';
  document.getElementById('conv-result').style.display='none';
  document.getElementById('btn-convert').disabled=true;
  document.getElementById('from-format-display').textContent='— upload an image —';
  document.querySelectorAll('.format-chip').forEach(c=>c.classList.remove('disabled','selected'));
  document.querySelector('[data-fmt="png"]').classList.add('selected');
  selectedFmt='png';
}

function formatBytes(b){
  if(b<1024)return b+' B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  return(b/1048576).toFixed(2)+' MB';
}

function dl(url,name){
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
}