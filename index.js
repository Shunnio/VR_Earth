import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

// ============================================================
// Google Earth VR – Solar System Simulation v29.0
// (Fixed sunUniforms bug, Cleaned up 3D Panel Text, CORS Fixed)
// ============================================================

// ─── 1. SCENE / CAMERA / RENDERER ───────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; 
renderer.xr.enabled = true; 
document.body.style.cssText = 'margin:0;overflow:hidden;background:#000;';
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.3;
controls.maxDistance = 30;

// Khai báo TextureLoader kèm cấp quyền CORS cho ảnh Wikipedia
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous'); 
const starTexture = loader.load('./textures/stars/circle.png');

// ─── TRỤC QUAY VR DOLLY & TAY CẦM META QUEST 3 ────────────────
const vrDolly = new THREE.Group();
const vrCameraOffset = new THREE.Group();
vrDolly.add(vrCameraOffset); 
scene.add(vrDolly);

let vrOrbitAngle = -Math.PI / 4; 
let vrDistance = 5.0; 

const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
vrCameraOffset.add(controller1);
vrCameraOffset.add(controller2);

const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
const laserMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6, linewidth: 2 });
const laser1 = new THREE.Line(laserGeo, laserMat);
const laser2 = new THREE.Line(laserGeo, laserMat.clone());
laser1.scale.z = 10; laser2.scale.z = 10;
controller1.add(laser1);
controller2.add(laser2);

renderer.xr.addEventListener('sessionstart', () => {
  vrCameraOffset.add(camera);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
});

renderer.xr.addEventListener('sessionend', () => {
  scene.add(camera);
  camera.position.copy(earthSystem.position).add(new THREE.Vector3(0, 1.5, 4.0));
  controls.target.copy(earthSystem.position);
});

// ─── 2. VŨ TRỤ VÔ HẠN (SKYBOX + SAO NỀN + SAO BĂNG) ───────────
const universeGroup = new THREE.Group();
scene.add(universeGroup);

// Bầu trời Ngân Hà 360 độ
const starBgGeo = new THREE.SphereGeometry(600, 64, 64);
const starBgMat = new THREE.MeshBasicMaterial({ 
  map: loader.load('./textures/07_milkyway.jpg'), 
  side: THREE.BackSide, color: 0xffffff, depthWrite: false 
});
const skybox = new THREE.Mesh(starBgGeo, starBgMat);
skybox.rotation.x = Math.PI / 4; skybox.rotation.y = -Math.PI / 6;
universeGroup.add(skybox);

// Sao nhấp nháy
const starsCount = 3000;
const posArray = new Float32Array(starsCount * 3);
const sizesArray = new Float32Array(starsCount);
const phasesArray = new Float32Array(starsCount);
for (let i = 0; i < starsCount; i++) {
  posArray[i * 3] = (Math.random() - 0.5) * 800; posArray[i * 3 + 1] = (Math.random() - 0.5) * 800; posArray[i * 3 + 2] = (Math.random() - 0.5) * 800;
  sizesArray[i] = Math.random() * 1.5 + 0.5; phasesArray[i] = Math.random() * Math.PI * 2;
}
const starsGeo = new THREE.BufferGeometry();
starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
starsGeo.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));
starsGeo.setAttribute('phase', new THREE.BufferAttribute(phasesArray, 1));

const starUniforms = { time: { value: 0 }, starTexture: { value: starTexture } };
const starsMat = new THREE.ShaderMaterial({
  uniforms: starUniforms,
  vertexShader: `uniform float time; attribute float size; attribute float phase; varying float vAlpha; void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; vAlpha = 0.2 + 0.5 * sin(time * 1.5 + phase); }`,
  fragmentShader: `uniform sampler2D starTexture; varying float vAlpha; void main() { vec4 texColor = texture2D(starTexture, gl_PointCoord); gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});
universeGroup.add(new THREE.Points(starsGeo, starsMat));

// Sao băng
const meteors = [];
for (let i = 0; i < 7; i++) {
  const mMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const mGeo = new THREE.CylinderGeometry(0.0, 0.3, 30, 8); mGeo.rotateX(-Math.PI / 2);
  const mMesh = new THREE.Mesh(mGeo, mMat); universeGroup.add(mMesh);
  meteors.push({ mesh: mMesh, active: false, timer: 5 + Math.random() * 10, progress: 0, start: new THREE.Vector3(), end: new THREE.Vector3() });
}

// ─── 3. MẶT TRỜI (KHÔI PHỤC SHADER PLASMA ĐÃ KHAI BÁO CHUẨN) ──
const sunGroup = new THREE.Group();
scene.add(sunGroup);
const SUN_R = 3.0; 

// KHAI BÁO sunUniforms Ở ĐÂY ĐỂ TRÁNH LỖI "IS NOT DEFINED"
const sunUniforms = { time: { value: 0 } };

const sunMat = new THREE.ShaderMaterial({
  uniforms: sunUniforms,
  vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPos; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform float time; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPos;
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){ 
      const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0); vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw); vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m; return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    float fbm(vec3 p) { float f = 0.0; f += 0.5000 * snoise(p); p = p * 2.02; f += 0.2500 * snoise(p); p = p * 2.03; f += 0.1250 * snoise(p); return f * 0.5 + 0.5; }
    void main(){
      float n = fbm(vPos * 2.5 + time * 0.15); vec3 color1 = vec3(1.0, 0.95, 0.4); vec3 color2 = vec3(0.9, 0.2, 0.0);
      vec3 finalColor = mix(color2, color1, n * 1.3); float fresnel = pow(1.0 - max(dot(vNormal, vec3(0,0,1)), 0.0), 2.0);
      gl_FragColor = vec4(finalColor + vec3(1.0, 0.8, 0.2) * fresnel, 1.0);
    }
  `,
});
sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 64, 64), sunMat));

const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
gradient.addColorStop(0.0, 'rgba(255, 230, 150, 1.0)'); gradient.addColorStop(0.3, 'rgba(255, 150, 20, 0.8)');
gradient.addColorStop(0.6, 'rgba(255, 60, 0, 0.3)'); gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
context.fillStyle = gradient; context.fillRect(0, 0, 256, 256); const haloTexture = new THREE.CanvasTexture(canvas);
const haloSprite1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: 0xffeebb, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
haloSprite1.scale.set(SUN_R * 3.5, SUN_R * 3.5, 1); sunGroup.add(haloSprite1);
const haloSprite2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: 0xff6600, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false }));
haloSprite2.scale.set(SUN_R * 5.0, SUN_R * 5.0, 1); sunGroup.add(haloSprite2);

// ─── 4. HỆ THỐNG TRÁI ĐẤT & MẶT TRĂNG ─────────────────────────
const earthSystem = new THREE.Group(); 
scene.add(earthSystem);

const ORBIT_RADIUS = 25.0; earthSystem.position.set(ORBIT_RADIUS, 0, 0); 

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.copy(sunGroup.position); sunLight.target = earthSystem;
scene.add(sunLight); scene.add(new THREE.DirectionalLight(0x2244aa, 0.1)); scene.add(new THREE.AmbientLight(0x334466, 0.15));

const earthGroup = new THREE.Group(); earthGroup.rotation.z = THREE.MathUtils.degToRad(23.5); earthSystem.add(earthGroup); 
const EARTH_R = 1.0;
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R, 128, 128),
  new THREE.MeshPhongMaterial({
    map: loader.load('./textures/00_earthmap8k.jpg'), 
    displacementMap: loader.load('./textures/01_earthbump1k.jpg'), displacementScale: 0.04,
    specularMap: loader.load('./textures/02_earthspec1k.jpg'), specular: new THREE.Color(0x55aacc), shininess: 20,
  })
);
earthGroup.add(earth);

const cityLightsMat = new THREE.ShaderMaterial({
  uniforms: { cityLightsMap: { value: loader.load('./textures/03_earthlights1k.jpg') }, sunDirection:  { value: new THREE.Vector3() } },
  vertexShader: `varying vec2 vUv; varying vec3 vNormal; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D cityLightsMap; uniform vec3 sunDirection; varying vec2 vUv; varying vec3 vNormal; void main(){ float night=clamp(-dot(vNormal,sunDirection)*3.0,0.0,1.0); vec4 t=texture2D(cityLightsMap,vUv); gl_FragColor=vec4(t.rgb*night*1.2, night*t.r); }`,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R+0.041,128,128), cityLightsMat));

const atmosMat = new THREE.ShaderMaterial({
  uniforms: { sunDirection: { value: new THREE.Vector3(1,0,0) } },
  vertexShader: `varying vec3 vNormal; varying vec3 vWorldPos; void main(){ vNormal=normalize(normalMatrix*normal); vWorldPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 sunDirection; varying vec3 vNormal; varying vec3 vWorldPos;
    void main(){
      vec3 viewDir=normalize(cameraPosition-vWorldPos); float fresnel=pow(1.0-max(dot(vNormal,viewDir),0.0),3.5);
      float sunFactor=clamp(dot(vNormal,sunDirection)*0.6+0.4,0.0,1.0); vec3 color=mix(vec3(0.9,0.45,0.15), vec3(0.25,0.55,1.0), smoothstep(0.2,0.7,sunFactor));
      gl_FragColor=vec4(color, fresnel*0.4*sunFactor);
    }
  `,
  blending: THREE.AdditiveBlending, transparent: true, side: THREE.FrontSide, depthWrite: false,
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.06,64,64), atmosMat));

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R*1.05, 64, 64),
  new THREE.MeshPhongMaterial({ map: loader.load('./textures/04_earthcloudmap.jpg'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
);
earthGroup.add(clouds);

const moonOrbitGroup = new THREE.Group(); moonOrbitGroup.rotation.x = THREE.MathUtils.degToRad(5.14); earthSystem.add(moonOrbitGroup);
const MOON_ORBIT_R = 4.0;
const moon = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 0.27, 64, 64), new THREE.MeshPhongMaterial({ map: loader.load('./textures/06_moon.jpg'), shininess: 5 }));
moonOrbitGroup.add(moon);

const orbitPts = []; for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; orbitPts.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS)); }
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineBasicMaterial({ color: 0x5588aa, transparent: true, opacity: 0.3 })));
const lunarOrbitPts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; lunarOrbitPts.push(new THREE.Vector3(Math.cos(a) * MOON_ORBIT_R, 0, Math.sin(a) * MOON_ORBIT_R)); }
moonOrbitGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lunarOrbitPts), new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 })));

// ─── 5. BẢNG THÔNG TIN HOLOGRAM 3D ĐI THEO TRÁI ĐẤT ────────────
const infoPanel3D = new THREE.Group();
infoPanel3D.visible = false;
scene.add(infoPanel3D);

const landmarkMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
landmarkMesh.position.y = 0.7; infoPanel3D.add(landmarkMesh);
const textCanvas = document.createElement('canvas'); textCanvas.width = 1024; textCanvas.height = 512;
const textCtx = textCanvas.getContext('2d'); const textTexture = new THREE.CanvasTexture(textCanvas);
const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, side: THREE.DoubleSide, opacity: 0.9 }));
textMesh.position.y = -0.3; infoPanel3D.add(textMesh);

let activePoint = null; 

function show3DPanel(point) {
  activePoint = point; 
  const locInfo = point.userData;
  
  // Tải ảnh Landmark
  loader.load(locInfo.img, function(tex) {
    landmarkMesh.material.map = tex;
    landmarkMesh.material.needsUpdate = true;
  });

  // Xóa và vẽ lại Canvas Text
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  const grad = textCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(0, 15, 30, 0.85)'); 
  grad.addColorStop(1, 'rgba(0, 40, 80, 0.95)');
  textCtx.fillStyle = grad; textCtx.fillRect(0, 0, 1024, 512);
  textCtx.strokeStyle = '#55aaff'; textCtx.lineWidth = 4; textCtx.strokeRect(2, 2, 1020, 508);

  // Tiêu đề (ĐÃ BỎ CHỮ "TARGET")
  textCtx.fillStyle = '#55ff55'; textCtx.font = 'bold 52px sans-serif'; 
  textCtx.fillText(`${locInfo.name.toUpperCase()}`, 30, 65);
  
  textCtx.fillStyle = '#ffffff'; textCtx.font = '28px sans-serif'; 
  textCtx.fillText(`Population: ${locInfo.pop}   |   Area: ${locInfo.area}`, 30, 115);

  // Hàm tự động ngắt dòng thông minh
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' '); let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (context.measureText(testLine).width > maxWidth && n > 0) { 
        context.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; 
      } else { line = testLine; }
    } 
    context.fillText(line, x, y);
    return y + lineHeight;
  }

  // Kinh tế chi tiết
  textCtx.fillStyle = '#88eeff'; textCtx.font = 'bold 28px sans-serif';
  textCtx.fillText('Economy:', 30, 170);
  textCtx.fillStyle = '#dddddd'; textCtx.font = '26px sans-serif';
  let nextY = wrapText(textCtx, locInfo.econ, 30, 210, 960, 36);

  // Văn hóa chi tiết
  textCtx.fillStyle = '#ffcc88'; textCtx.font = 'bold 28px sans-serif';
  textCtx.fillText('Culture:', 30, nextY + 20);
  textCtx.fillStyle = '#dddddd'; textCtx.font = '26px sans-serif';
  wrapText(textCtx, locInfo.cult, 30, nextY + 60, 960, 36);

  textTexture.needsUpdate = true;
  infoPanel3D.visible = true;
}

// ─── 6. DỮ LIỆU ĐỊA ĐIỂM WIKIPEDIA 2026 (FULL TEXT) ────────────
const interactionPoints = [];
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180); const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-(radius * Math.sin(phi) * Math.cos(theta)), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

const locations = [
  { lat: 14.0583, lon: 108.2772, name: 'Việt Nam', cCode: 'vn', pop: '102.2 Triệu', area: '331,212 km²', 
    econ: 'Là một nền kinh tế phát triển cực kỳ nhanh chóng tại Đông Nam Á. Đang chuyển dịch mạnh mẽ sang công nghiệp sản xuất điện tử, phần mềm và chip bán dẫn toàn cầu.', 
    cult: 'Sở hữu di sản văn hóa đồ sộ với 54 dân tộc anh em. Nền ẩm thực vô cùng đa dạng, vươn tầm thế giới (Phở, Bánh Mì) cùng các kỳ quan thiên nhiên ngoạn mục.', 
    img: './img/HaLongBay.jpg' },
  { lat: 36.2048, lon: 138.2529, name: 'Nhật Bản', cCode: 'jp', pop: '122.4 Triệu', area: '377,975 km²', 
    econ: 'Cường quốc kinh tế thứ 4 thế giới, đi đầu trong lĩnh vực công nghệ cao, sản xuất ô tô và robot. Hiện đang thúc đẩy mạnh mẽ mô hình siêu thông minh "Xã hội 5.0".', 
    cult: 'Sự giao thoa hoàn hảo giữa tín ngưỡng Thần Đạo truyền thống và văn hóa đại chúng cực thịnh. Đất nước nổi tiếng toàn cầu với ngành công nghiệp Anime và Manga.', 
    img: './img/MountFuji.jpg' },
  { lat: 35.9078, lon: 127.7669, name: 'Hàn Quốc', cCode: 'kr', pop: '51.6 Triệu', area: '100,210 km²', 
    econ: 'Nền kinh tế định hướng xuất khẩu, được dẫn dắt bởi các tập đoàn Chaebol khổng lồ. Thống trị thị trường toàn cầu về sản xuất chip nhớ, màn hình và đóng tàu.', 
    cult: 'Làn sóng Hallyu (bao gồm âm nhạc K-Pop, phim truyền hình K-Drama) lan tỏa sức ảnh hưởng mạnh mẽ trên toàn hành tinh, kết hợp nền tảng Nho giáo chú trọng giáo dục.', 
    img: './img/Seoul.jpg' },
  { lat: 37.0902, lon: -95.7129, name: 'Hoa Kỳ', cCode: 'us', pop: '349.0 Triệu', area: '9.83 Triệu km²', 
    econ: 'Nền kinh tế lớn nhất thế giới tính theo GDP danh nghĩa. Đóng vai trò là trung tâm tài chính toàn cầu, dẫn dắt các cuộc cách mạng về trí tuệ nhân tạo (AI) và vũ trụ.', 
    cult: 'Là một hợp chủng quốc đa sắc tộc với tinh thần đề cao tự do. Xuất khẩu quyền lực mềm văn hóa mạnh mẽ nhất thông qua điện ảnh Hollywood và công nghiệp âm nhạc.', 
    img: './img/USA.jpg' },
  { lat: 35.8617, lon: 104.1954, name: 'Trung Quốc', cCode: 'cn', pop: '1.41 Tỷ', area: '9.59 Triệu km²', 
    econ: 'Nền kinh tế lớn thứ hai toàn cầu, được mệnh danh là công xưởng của thế giới. Đang vươn lên thống trị tuyệt đối trong ngành công nghiệp xe điện (EV) và năng lượng mới.', 
    cult: 'Cái nôi của nền văn minh phương Đông liên tục hơn 5000 năm. Sở hữu di sản Nho giáo sâu sắc, kiến trúc vĩ đại và nền công nghiệp giải trí nội địa khổng lồ.', 
    img: './img/TheGreatWall.jpg' },
  { lat: 20.5937, lon: 78.9629, name: 'Ấn Độ', cCode: 'in', pop: '1.45 Tỷ', area: '3.28 Triệu km²', 
    econ: 'Nền kinh tế phát triển nhanh nhất trong nhóm G20. Được biết đến như cường quốc về gia công phần mềm IT, công nghệ sinh học và ngành công nghiệp dược phẩm.', 
    cult: 'Cái nôi của các tôn giáo lớn như Ấn Độ giáo và Phật giáo. Nền văn hóa vô cùng đa dạng về ngôn ngữ, phong tục và sức hút mãnh liệt từ điện ảnh Bollywood.', 
    img: './img/India.jpg' },
  { lat: 46.2276, lon: 2.2137, name: 'Pháp', cCode: 'fr', pop: '68.0 Triệu', area: '551,695 km²', 
    econ: 'Đóng vai trò trụ cột của Liên minh Châu Âu. Thống trị toàn cầu trong lĩnh vực thiết kế thời trang, hàng xa xỉ, mỹ phẩm, du lịch và năng lượng hạt nhân tiên tiến.', 
    cult: 'Được tôn vinh là Kinh đô ánh sáng và sự lãng mạn. Là cái nôi của triết học hiện đại, nghệ thuật, điện ảnh, và là biểu tượng của tinh hoa văn hóa ẩm thực cao cấp.', 
    img: './img/Paris.jpg' },
  { lat: 55.3781, lon: -3.4360, name: 'Anh Quốc', cCode: 'gb', pop: '67.3 Triệu', area: '242,495 km²', 
    econ: 'Thủ đô London duy trì vị thế là trung tâm tài chính và dịch vụ hàng đầu thế giới. Nền kinh tế có thế mạnh vượt trội về Fintech, giáo dục và nghiên cứu khoa học.', 
    cult: 'Nguồn cội của ngôn ngữ toàn cầu và nơi khởi nguồn Cách mạng Công nghiệp. Sở hữu lịch sử Hoàng gia lâu đời, nền văn học đồ sộ và nền âm nhạc tiên phong.', 
    img: './img/London.jpg' },
  { lat: 51.1657, lon: 10.4515, name: 'Đức', cCode: 'de', pop: '83.5 Triệu', area: '357,022 km²', 
    econ: 'Đầu tàu và là trái tim kinh tế của Châu Âu. Mang thế mạnh tuyệt đối về kỹ thuật cơ khí chính xác, sản xuất ô tô hạng sang và ngành công nghiệp hóa chất thế giới.', 
    cult: 'Được mệnh danh là xứ sở của những nhà tư tưởng, triết gia và nhạc sĩ vĩ đại (Beethoven, Kant). Nổi tiếng với lối sống kỷ luật và bảo tồn xuất sắc văn hóa địa phương.', 
    img: './img/Germany.jpg' },
  { lat: -14.2350, lon: -51.9253, name: 'Brazil', cCode: 'br', pop: '218.8 Triệu', area: '8.51 Triệu km²', 
    econ: 'Nền kinh tế lớn nhất khu vực Nam Mỹ. Đóng vai trò siêu cường về xuất khẩu nông sản (đậu nành, cà phê) và dẫn đầu thế giới về khai thác quặng khoáng sản.', 
    cult: 'Sự pha trộn rực rỡ và bùng nổ giữa văn hóa bản địa, Châu Phi và Bồ Đào Nha. Nổi tiếng toàn cầu với vũ điệu Samba cuồng nhiệt và tình yêu bóng đá mãnh liệt.', 
    img: './img/Brazil.jpg' },
  { lat: -25.2744, lon: 133.7751, name: 'Úc', cCode: 'au', pop: '27.4 Triệu', area: '7.69 Triệu km²', 
    econ: 'Quốc gia có GDP bình quân đầu người cao hàng đầu. Nền kinh tế phụ thuộc mạnh mẽ vào việc xuất khẩu dồi dào tài nguyên khoáng sản, giáo dục và du lịch.', 
    cult: 'Nổi bật với lối sống ngoài trời tự do và phóng khoáng. Nền văn hóa tôn trọng sự đa nguyên và luôn nỗ lực bảo tồn di sản độc đáo của người bản địa (Aboriginal).', 
    img: './img/Sydney.jpg' },
  { lat: -30.5595, lon: 22.9375, name: 'Nam Phi', cCode: 'za', pop: '61.0 Triệu', area: '1.22 Triệu km²', 
    econ: 'Quốc gia công nghiệp hóa và phát triển nhất lục địa Châu Phi. Chiếm ưu thế lớn trên thị trường toàn cầu về khai thác và xuất khẩu kim loại quý như vàng, bạch kim.', 
    cult: 'Được thế giới vinh danh là "Quốc gia Cầu vồng". Thể hiện sự kiên cường sâu sắc và tinh thần hòa giải vĩ đại sau quá trình xóa bỏ chế độ phân biệt chủng tộc Apartheid.', 
    img: './img/SouthAfrica.jpg' }
];

const markerGeo = new THREE.SphereGeometry(0.015, 16, 16);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const glowGeo = new THREE.SphereGeometry(0.025, 16, 16);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });

locations.forEach(loc => {
  const markerGroup = new THREE.Group();
  markerGroup.position.copy(latLonToVector3(loc.lat, loc.lon, EARTH_R + 0.055)); 
  
  const core = new THREE.Mesh(markerGeo, markerMat.clone());
  const glow = new THREE.Mesh(glowGeo, glowMat.clone());
  markerGroup.add(core); markerGroup.add(glow);
  
  const flagTex = loader.load(`https://flagcdn.com/w160/${loc.cCode}.png`);
  const flagMat = new THREE.SpriteMaterial({ map: flagTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const flag = new THREE.Sprite(flagMat);
  flag.scale.set(0.08, 0.052, 1); flag.position.set(0, 0.035, 0); 
  markerGroup.add(flag);
  
  core.userData = { ...loc, flag: flag, glow: glow };
  earthGroup.add(markerGroup);
  interactionPoints.push(core);
});

camera.position.set(ORBIT_RADIUS, 1.5, 4.0);
controls.target.copy(earthSystem.position);
let previousEarthPosition = new THREE.Vector3().copy(earthSystem.position);

// ─── 7. TƯƠNG TÁC CHUỘT VÀ TAY CẦM VR ──────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPoint = null;

window.addEventListener('mousemove', (e) => {
  if(renderer.xr.isPresenting) return; 
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('click', () => {
  if (!renderer.xr.isPresenting) {
    if (hoveredPoint) { show3DPanel(hoveredPoint); } else { infoPanel3D.visible = false; activePoint = null; }
  }
});
function onSelect() {
  if (hoveredPoint) { show3DPanel(hoveredPoint); } else { infoPanel3D.visible = false; activePoint = null; }
}
controller1.addEventListener('select', onSelect);
controller2.addEventListener('select', onSelect);

// ─── 8. GIAO DIỆN HUD 2D (Desktop) ─────────────────────────────
const hud = document.createElement('div');
hud.id = 'desktopHUD';
hud.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:1000;';
hud.innerHTML = `
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    #uiOverlay_sci{font-family:'Share Tech Mono',monospace;color:#88ccff;pointer-events:auto;}
    .hud-panel{position:absolute;background:rgba(0,12,35,0.75);border:1px solid rgba(80,160,255,0.4);border-radius:6px;padding:15px;backdrop-filter:blur(8px);min-width:200px; box-shadow:0 4px 15px rgba(0,0,0,0.5);}
    .hud-title{font-size:14px;letter-spacing:1px;color:#33aaff;margin-bottom:12px;border-bottom:1px solid rgba(80,160,255,0.3);padding-bottom:6px;font-weight:bold;}
    .hud-item{font-size:12px;color:#bbddff;line-height:2.0;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);}
    .hud-stat{color:#fff;font-weight:bold;text-align:right;}
    input[type=range] { -webkit-appearance: none; width: 100%; background: rgba(80,160,255,0.2); height: 4px; border-radius: 2px; outline: none; margin-top: 8px; cursor: pointer; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #88eeff; border-radius: 50%; box-shadow: 0 0 8px #88eeff; cursor: pointer; }
  </style>
  <div id="uiOverlay_sci">
    <div class="hud-panel" style="bottom:20px;right:20px;min-width:180px;">
      <div class="hud-title" style="font-size:12px;">SATELLITE CONTROLS</div>
      <div class="hud-item">ALTITUDE <span class="hud-stat" id="hudAltitude">--</span></div>
      
      <div style="margin-top:10px; border-top:1px solid rgba(80,160,255,0.3); padding-top:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#33aaff;">
          <span>SUN BRIGHTNESS</span>
          <span id="lightVal" style="color:#fff; font-weight:bold;">1.5</span>
        </div>
        <input type="range" id="lightIntensity" min="0" max="5" step="0.1" value="1.5">
      </div>
      
      <div style="margin-top:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#33aaff;">
          <span>EARTH ROTATION</span>
          <span id="speedVal" style="color:#fff; font-weight:bold;">1.0X</span>
        </div>
        <input type="range" id="rotSpeed" min="0" max="10" step="0.1" value="1">
      </div>
    </div>
  </div>
`;
document.body.appendChild(hud);

document.getElementById('lightIntensity').addEventListener('input', (e) => {
  sunLight.intensity = parseFloat(e.target.value);
  document.getElementById('lightVal').textContent = sunLight.intensity.toFixed(1);
});
let earthRotationSpeedMultiplier = 1.0;
document.getElementById('rotSpeed').addEventListener('input', (e) => {
  earthRotationSpeedMultiplier = parseFloat(e.target.value);
  document.getElementById('speedVal').textContent = earthRotationSpeedMultiplier === 0 ? 'PAUSED' : earthRotationSpeedMultiplier.toFixed(1) + 'X';
});


// ─── 9. ANIMATION LOOP ────────────────────────────────────────
const clock = new THREE.Clock();
const BASE_ROTATION_SPEED = 0.03; 
const BASE_ORBIT_SPEED = 0.005; 
const BASE_MOON_SPEED = 0.02; 

let earthOrbitAngle = 0; let moonOrbitAngle = 0;

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta(); const time = clock.getElapsedTime();
  starUniforms.time.value = time; sunUniforms.time.value = time; 

  if (renderer.xr.isPresenting) { document.getElementById('desktopHUD').style.display = 'none'; } 
  else { document.getElementById('desktopHUD').style.display = 'block'; }

  if (renderer.xr.isPresenting) {
    const tempMatrix = new THREE.Matrix4(); tempMatrix.identity().extractRotation(controller1.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller1.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  } else { raycaster.setFromCamera(mouse, camera); }

  const intersects = raycaster.intersectObjects(interactionPoints);
  if (intersects.length > 0) {
    const point = intersects[0].object;
    if (hoveredPoint !== point) {
      if (hoveredPoint) { hoveredPoint.userData.flag.scale.set(0.08, 0.052, 1); hoveredPoint.userData.glow.material.opacity = 0.2; }
      hoveredPoint = point;
      hoveredPoint.material.color.setHex(0x55ff55); hoveredPoint.userData.flag.scale.set(0.12, 0.08, 1);
      hoveredPoint.userData.glow.material.color.setHex(0x55ff55); hoveredPoint.userData.glow.material.opacity = 0.5;
      document.body.style.cursor = 'pointer';
    }
    if (renderer.xr.isPresenting) { laser1.scale.z = intersects[0].distance; laser1.material.color.setHex(0x55ff55); }
  } else {
    if (hoveredPoint) {
      hoveredPoint.userData.flag.scale.set(0.08, 0.052, 1); hoveredPoint.userData.glow.material.opacity = 0.2;
      hoveredPoint = null; document.body.style.cursor = 'default';
    }
    if (renderer.xr.isPresenting) { laser1.scale.z = 10; laser1.material.color.setHex(0x88ccff); }
  }

  if (infoPanel3D.visible && activePoint) {
    const earthPos = new THREE.Vector3(); earthSystem.getWorldPosition(earthPos);
    const worldPos = new THREE.Vector3(); activePoint.getWorldPosition(worldPos);
    const direction = worldPos.clone().sub(earthPos).normalize();
    infoPanel3D.position.copy(worldPos).add(direction.multiplyScalar(0.6));
    infoPanel3D.lookAt(camera.position);
  }

  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
  meteors.forEach(m => {
    if (!m.active) {
      m.timer -= delta;
      if (m.timer <= 0) {
        m.active = true; m.timer = 10 + Math.random() * 5; m.progress = 0;
        const spawnCenter = camDir.clone().multiplyScalar(120); 
        m.start.copy(spawnCenter).add(new THREE.Vector3((Math.random()-0.5)*200, (Math.random()-0.5)*200, (Math.random()-0.5)*200));
        const flyDir = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize();
        m.end.copy(m.start).add(flyDir.multiplyScalar(250)); 
        m.mesh.position.copy(m.start); m.mesh.lookAt(m.start.clone().add(flyDir)); 
      }
    } else {
      m.progress += delta * 1.5; m.mesh.position.lerpVectors(m.start, m.end, m.progress);
      m.mesh.material.opacity = Math.sin(m.progress * Math.PI) * 1.5;
      if (m.progress >= 1.0) { m.active = false; m.mesh.material.opacity = 0; }
    }
  });
  
  earthGroup.rotation.y += delta * BASE_ROTATION_SPEED * earthRotationSpeedMultiplier;
  clouds.rotation.y += delta * (BASE_ROTATION_SPEED + 0.01) * earthRotationSpeedMultiplier; 

  earthOrbitAngle += delta * BASE_ORBIT_SPEED * earthRotationSpeedMultiplier; 
  earthSystem.position.x = Math.cos(earthOrbitAngle) * ORBIT_RADIUS;
  earthSystem.position.z = Math.sin(earthOrbitAngle) * ORBIT_RADIUS;

  moonOrbitAngle -= delta * BASE_MOON_SPEED * earthRotationSpeedMultiplier; 
  moon.position.set(Math.cos(moonOrbitAngle) * MOON_ORBIT_R, 0, Math.sin(moonOrbitAngle) * MOON_ORBIT_R);
  moon.rotation.y = moonOrbitAngle; 

  const dx = earthSystem.position.x - previousEarthPosition.x;
  const dz = earthSystem.position.z - previousEarthPosition.z;
  
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes) {
          const stickX = source.gamepad.axes.length > 2 ? source.gamepad.axes[2] : source.gamepad.axes[0];
          const stickY = source.gamepad.axes.length > 3 ? source.gamepad.axes[3] : source.gamepad.axes[1];
          if (Math.abs(stickX) > 0.1) vrOrbitAngle -= stickX * 0.03; 
          if (Math.abs(stickY) > 0.1) vrDistance += stickY * 0.05;   
        }
      }
    }
    vrDistance = THREE.MathUtils.clamp(vrDistance, 1.5, 12.0);
    vrDolly.position.copy(earthSystem.position);
    vrDolly.rotation.y = vrOrbitAngle;
    vrCameraOffset.position.set(0, 0, vrDistance);
  } else {
    camera.position.x += dx; camera.position.z += dz;
    controls.target.copy(earthSystem.position);
  }
  
  previousEarthPosition.copy(earthSystem.position);
  
  camera.getWorldPosition(new THREE.Vector3());
  universeGroup.position.copy(camera.position); 

  const sunDirW = sunGroup.position.clone().sub(earthSystem.position).normalize();
  const invN = new THREE.Matrix3().getNormalMatrix(earthGroup.matrixWorld).invert();
  const sunDirL = sunDirW.clone().applyMatrix3(invN).normalize();
  atmosMat.uniforms.sunDirection.value.copy(sunDirL);
  cityLightsMat.uniforms.sunDirection.value.copy(sunDirL);

  const earthWorldPos = new THREE.Vector3(); earthGroup.getWorldPosition(earthWorldPos);
  interactionPoints.forEach(point => {
    if (point !== hoveredPoint) { 
      const pointWorldPos = new THREE.Vector3(); point.getWorldPosition(pointWorldPos);
      const dot = pointWorldPos.clone().sub(earthWorldPos).normalize().dot(sunDirW);
      if (dot < -0.1) { point.material.color.setHex(0xffffff); point.userData.glow.material.color.setHex(0xcccccc); } 
      else { point.material.color.setHex(0xff3333); point.userData.glow.material.color.setHex(0xffffff); }
    }
  });

  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
  document.getElementById('hudAltitude').textContent = Number((camera.position.length() - 1) * 6371).toFixed(0) + ' KM';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});