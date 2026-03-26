import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

// ============================================================
// Google Earth VR – Solar System Simulation v15.0
// (Perfected VR Camera Rig, Smooth Joystick Orbit, Fixed Spawn)
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
renderer.xr.enabled = true; // Bật WebXR
document.body.style.cssText = 'margin:0;overflow:hidden;background:#000;';
document.body.appendChild(renderer.domElement);

document.body.appendChild(VRButton.createButton(renderer));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.3;
controls.maxDistance = 30;

const loader = new THREE.TextureLoader();

// ─── TRỤC QUAY VR (VR RIG HOÀN HẢO CHỐNG LỖI GÓC NHÌN) ────────
const vrDolly = new THREE.Group();
const vrCameraOffset = new THREE.Group();
vrDolly.add(vrCameraOffset); // CameraOffset là con của Dolly
scene.add(vrDolly);

let vrOrbitAngle = -Math.PI / 4; // Bắt đầu ở góc chéo để thấy cả ban ngày lẫn ban đêm của Trái Đất
let vrDistance = 5.0; // Khoảng cách từ bạn đến Trái Đất

renderer.xr.addEventListener('sessionstart', () => {
  // Khi đeo kính, cắm camera vào Offset và reset tọa độ gốc của camera
  vrCameraOffset.add(camera);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
});

renderer.xr.addEventListener('sessionend', () => {
  // Khi tháo kính, trả camera ra môi trường bình thường
  scene.add(camera);
  camera.position.copy(earthGroup.position).add(new THREE.Vector3(0, 1.5, 4.0));
  controls.target.copy(earthGroup.position);
});

// ─── 2. VŨ TRỤ VÔ HẠN ─────────────────────────────────────────
const universeGroup = new THREE.Group();
scene.add(universeGroup);

const starBgGeo = new THREE.SphereGeometry(600, 32, 32);
const starBgMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide, depthWrite: false });
universeGroup.add(new THREE.Mesh(starBgGeo, starBgMat));

const starsCount = 6000;
const posArray = new Float32Array(starsCount * 3);
const sizesArray = new Float32Array(starsCount);
const phasesArray = new Float32Array(starsCount);
for (let i = 0; i < starsCount; i++) {
  posArray[i * 3] = (Math.random() - 0.5) * 800;
  posArray[i * 3 + 1] = (Math.random() - 0.5) * 800;
  posArray[i * 3 + 2] = (Math.random() - 0.5) * 800;
  sizesArray[i] = Math.random() * 2.0 + 1.0;
  phasesArray[i] = Math.random() * Math.PI * 2;
}
const starsGeo = new THREE.BufferGeometry();
starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
starsGeo.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));
starsGeo.setAttribute('phase', new THREE.BufferAttribute(phasesArray, 1));

const starUniforms = { time: { value: 0 }, starTexture: { value: loader.load('./textures/stars/circle.png') } };
const starsMat = new THREE.ShaderMaterial({
  uniforms: starUniforms,
  vertexShader: `
    uniform float time; attribute float size; attribute float phase; varying float vAlpha;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      vAlpha = 0.3 + 0.7 * sin(time * 2.0 + phase);
    }
  `,
  fragmentShader: `
    uniform sampler2D starTexture; varying float vAlpha;
    void main() {
      vec4 texColor = texture2D(starTexture, gl_PointCoord);
      gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha);
    }
  `,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});
universeGroup.add(new THREE.Points(starsGeo, starsMat));

// ─── 3. MẶT TRỜI (GIỮ NGUYÊN BẢN ĐẸP NHẤT) ─────────────────────
const sunGroup = new THREE.Group();
scene.add(sunGroup);

const SUN_R = 3.0; 
const sunUniforms = { time: { value: 0 } };
const sunMat = new THREE.ShaderMaterial({
  uniforms: sunUniforms,
  vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPos; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform float time; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPos;
    float noise(vec3 p) { return sin(p.x*3.0 + time)*cos(p.y*3.0 + time)*sin(p.z*3.0)*0.5 + 0.5; }
    void main(){
      float n = noise(vPos + time * 0.17); 
      vec3 color1 = vec3(1.0, 0.95, 0.5); 
      vec3 color2 = vec3(1.0, 0.3, 0.0);  
      vec3 finalColor = mix(color2, color1, n * 1.5);
      float fresnel = pow(1.0 - max(dot(vNormal, vec3(0,0,1)), 0.0), 2.0);
      gl_FragColor = vec4(finalColor + vec3(1.0, 0.8, 0.2) * fresnel, 1.0);
    }
  `,
});
sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 64, 64), sunMat));

const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256;
const context = canvas.getContext('2d');
const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
gradient.addColorStop(0.0, 'rgba(255, 230, 150, 1.0)');
gradient.addColorStop(0.3, 'rgba(255, 150, 20, 0.8)');
gradient.addColorStop(0.6, 'rgba(255, 60, 0, 0.3)');
gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
const haloTexture = new THREE.CanvasTexture(canvas);

const haloSprite1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: 0xffeebb, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
haloSprite1.scale.set(SUN_R * 3.5, SUN_R * 3.5, 1);
sunGroup.add(haloSprite1);

const haloSprite2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: 0xff6600, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false }));
haloSprite2.scale.set(SUN_R * 5.0, SUN_R * 5.0, 1);
sunGroup.add(haloSprite2);

// ─── 4. ĐƯỜNG QUỸ ĐẠO MỜ ──────────────────────────────────────
const ORBIT_RADIUS = 25.0; 
const orbitPts = [];
for (let i = 0; i <= 128; i++) {
  const a = (i / 128) * Math.PI * 2;
  orbitPts.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS));
}
const orbitLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(orbitPts),
  new THREE.LineBasicMaterial({ color: 0x5588aa, transparent: true, opacity: 0.3 })
);
scene.add(orbitLine);

// ─── 5. ÁNH SÁNG ──────────────────────────────────────────────
const sunLight = new THREE.DirectionalLight(0xfff5cc, 0.5);
sunLight.position.copy(sunGroup.position);
scene.add(sunLight);
scene.add(new THREE.DirectionalLight(0x2244aa, 0.1)); 
scene.add(new THREE.AmbientLight(0x334466, 0.2));

// ─── 6. TRÁI ĐẤT ──────────────────────────────────────────────
const earthGroup = new THREE.Group();
earthGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
scene.add(earthGroup);
sunLight.target = earthGroup;

let earthOrbitAngle = 0; 
earthGroup.position.set(ORBIT_RADIUS, 0, 0); 

camera.position.set(ORBIT_RADIUS, 1.5, 4.0);
controls.target.copy(earthGroup.position);
let previousEarthPosition = new THREE.Vector3().copy(earthGroup.position);

const EARTH_R = 1.0;

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R, 128, 128),
  new THREE.MeshPhongMaterial({
    map: loader.load('./textures/00_earthmap1k.jpg'),
    bumpMap: loader.load('./textures/01_earthbump1k.jpg'), bumpScale: 0.02,
    specularMap: loader.load('./textures/02_earthspec1k.jpg'), specular: new THREE.Color(0x55aacc), shininess: 20,
  })
);
earthGroup.add(earth);

const cityLightsMat = new THREE.ShaderMaterial({
  uniforms: { cityLightsMap: { value: loader.load('./textures/03_earthlights1k.jpg') }, sunDirection:  { value: new THREE.Vector3() } },
  vertexShader: `varying vec2 vUv; varying vec3 vNormal; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D cityLightsMap; uniform vec3 sunDirection; varying vec2 vUv; varying vec3 vNormal;
    void main(){
      float night=clamp(-dot(vNormal,sunDirection)*3.0,0.0,1.0);
      vec4 t=texture2D(cityLightsMap,vUv);
      gl_FragColor=vec4(t.rgb*night*1.2, night*t.r);
    }
  `,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R+0.002,128,128), cityLightsMat));

const atmosMat = new THREE.ShaderMaterial({
  uniforms: { sunDirection: { value: new THREE.Vector3(1,0,0) } },
  vertexShader: `varying vec3 vNormal; varying vec3 vWorldPos; void main(){ vNormal=normalize(normalMatrix*normal); vWorldPos=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 sunDirection; varying vec3 vNormal; varying vec3 vWorldPos;
    void main(){
      vec3 viewDir=normalize(cameraPosition-vWorldPos);
      float fresnel=pow(1.0-max(dot(vNormal,viewDir),0.0),3.5);
      float sunFactor=clamp(dot(vNormal,sunDirection)*0.6+0.4,0.0,1.0);
      vec3 color=mix(vec3(0.9,0.45,0.15), vec3(0.25,0.55,1.0), smoothstep(0.2,0.7,sunFactor));
      gl_FragColor=vec4(color, fresnel*0.4*sunFactor);
    }
  `,
  blending: THREE.AdditiveBlending, transparent: true, side: THREE.FrontSide, depthWrite: false,
});
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*1.025,64,64), atmosMat));

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R*1.008, 64, 64),
  new THREE.MeshPhongMaterial({ map: loader.load('./textures/04_earthcloudmap.jpg'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
);
earthGroup.add(clouds);

// ─── 7. DỮ LIỆU WIKIPEDIA 2026 ───────────────────────────────
const interactionPoints = [];
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-(radius * Math.sin(phi) * Math.cos(theta)), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

const locations = [
  { lat: 14.0583, lon: 108.2772, name: 'Việt Nam', cCode: 'vn', pop: '102.2 Triệu', area: '331,212 km²', econ: 'Nằm trong top 35 nền kinh tế lớn nhất toàn cầu. Trung tâm sản xuất chip bán dẫn, điện tử và FDI trọng điểm tại Đông Nam Á.', cult: 'Sở hữu 54 dân tộc anh em. Nền ẩm thực vươn tầm thế giới (Phở, Bánh Mì) và có sức mạnh mềm văn hóa ngày càng tăng.' },
  { lat: 36.2048, lon: 138.2529, name: 'Nhật Bản', cCode: 'jp', pop: '122.4 Triệu', area: '377,975 km²', econ: 'Cường quốc kinh tế thứ 4 thế giới. Đang chuyển dịch mạnh sang "Xã hội 5.0", dẫn đầu về công nghệ robot, AI và xe xanh.', cult: 'Sự giao thoa hoàn hảo giữa tín ngưỡng Thần Đạo truyền thống và văn hóa đại chúng cực thịnh (Anime, Manga, Gaming).' },
  { lat: 35.9078, lon: 127.7669, name: 'Hàn Quốc', cCode: 'kr', pop: '51.6 Triệu', area: '100,210 km²', econ: 'Cường quốc xuất khẩu công nghệ cao, thống trị toàn cầu về chip nhớ, đóng tàu biển và ô tô, vận hành bởi các Chaebol.', cult: 'Làn sóng Hallyu (K-Pop, K-Drama) lan tỏa sức ảnh hưởng khắp hành tinh, kết hợp nền tảng Nho giáo chú trọng giáo dục.' },
  { lat: 37.0902, lon: -95.7129, name: 'Hoa Kỳ', cCode: 'us', pop: '349.0 Triệu', area: '9.83 Triệu km²', econ: 'Nền kinh tế danh nghĩa số 1 thế giới. Trung tâm tài chính toàn cầu, dẫn dắt các cuộc cách mạng về AI, vũ trụ và phần mềm.', cult: 'Hợp chủng quốc đa sắc tộc, đa nguyên văn hóa. Nơi xuất khẩu văn hóa mạnh mẽ nhất thông qua Hollywood và nền âm nhạc.' },
  { lat: 35.8617, lon: 104.1954, name: 'Trung Quốc', cCode: 'cn', pop: '1.41 Tỷ', area: '9.59 Triệu km²', econ: 'Nền kinh tế lớn thứ hai toàn cầu, công xưởng của thế giới. Thống trị ngành công nghiệp xe điện (EV) và năng lượng tái tạo.', cult: 'Nền văn minh liên tục hơn 5000 năm. Sở hữu di sản Nho giáo sâu sắc và nền công nghiệp giải trí nội địa khổng lồ.' },
  { lat: 20.5937, lon: 78.9629, name: 'Ấn Độ', cCode: 'in', pop: '1.45 Tỷ', area: '3.28 Triệu km²', econ: 'Kinh tế phát triển nhanh nhất khối G20. Cường quốc về gia công phần mềm IT, công nghệ sinh học và dược phẩm toàn cầu.', cult: 'Cái nôi của các tôn giáo lớn (Ấn Độ giáo, Phật giáo). Nền văn hóa cực kỳ đa dạng về ngôn ngữ và sức hút từ Bollywood.' },
  { lat: 46.2276, lon: 2.2137, name: 'Pháp', cCode: 'fr', pop: '68.0 Triệu', area: '551,695 km²', econ: 'Nền kinh tế lớn thứ 7 thế giới. Thống trị toàn cầu trong lĩnh vực hàng xa xỉ, du lịch, hàng không vũ trụ và năng lượng hạt nhân.', cult: 'Kinh đô ánh sáng của thế giới. Cái nôi của triết học hiện đại, điện ảnh, và là tâm điểm của văn hóa ẩm thực, thời trang.' },
  { lat: 55.3781, lon: -3.4360, name: 'Anh Quốc', cCode: 'gb', pop: '67.3 Triệu', area: '242,495 km²', econ: 'Nền kinh tế lớn thứ 6. Thành phố London duy trì vị thế là một trong trung tâm tài chính và Fintech hàng đầu thế giới.', cult: 'Nguồn cội của ngôn ngữ toàn cầu. Sở hữu kho tàng văn học đồ sộ, lịch sử Hoàng gia lâu đời và nền âm nhạc tiên phong.' },
  { lat: 51.1657, lon: 10.4515, name: 'Đức', cCode: 'de', pop: '83.5 Triệu', area: '357,022 km²', econ: 'Đầu tàu kinh tế của Châu Âu. Thế mạnh tuyệt đối về kỹ thuật cơ khí, sản xuất ô tô hạng sang và ngành công nghiệp hóa chất.', cult: 'Được mệnh danh là xứ sở của những nhà tư tưởng và nhạc sĩ vĩ đại (Beethoven, Kant), bảo tồn tốt truyền thống địa phương.' },
  { lat: -14.2350, lon: -51.9253, name: 'Brazil', cCode: 'br', pop: '218.8 Triệu', area: '8.51 Triệu km²', econ: 'Nền kinh tế lớn nhất Nam Mỹ. Siêu cường về xuất khẩu nông sản (đậu nành, cà phê) và dẫn đầu về khai thác quặng, khoáng sản.', cult: 'Sự pha trộn rực rỡ giữa văn hóa bản địa, Châu Phi và Bồ Đào Nha. Nổi tiếng toàn cầu với vũ điệu Samba và bóng đá.' },
  { lat: -25.2744, lon: 133.7751, name: 'Úc', cCode: 'au', pop: '27.4 Triệu', area: '7.69 Triệu km²', econ: 'Quốc gia có GDP bình quân đầu người cao hàng đầu. Nền kinh tế phụ thuộc mạnh vào xuất khẩu khoáng sản và giáo dục.', cult: 'Lối sống ngoài trời phóng khoáng. Nền văn hóa tôn trọng đa nguyên và bảo tồn di sản độc đáo của người bản địa (Aboriginal).' },
  { lat: -30.5595, lon: 22.9375, name: 'Nam Phi', cCode: 'za', pop: '61.0 Triệu', area: '1.22 Triệu km²', econ: 'Quốc gia công nghiệp hóa nhất Châu Phi. Chiếm ưu thế về khai thác kim loại quý (vàng, bạch kim) dù đối mặt nhiều thách thức.', cult: 'Được gọi là "Quốc gia Cầu vồng" với 12 ngôn ngữ chính thức. Sự kiên cường sâu sắc sau quá trình xóa bỏ chế độ Apartheid.' },
];

const markerGeo = new THREE.SphereGeometry(0.012, 16, 16);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const glowGeo = new THREE.SphereGeometry(0.02, 16, 16);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });

locations.forEach(loc => {
  const markerGroup = new THREE.Group();
  markerGroup.position.copy(latLonToVector3(loc.lat, loc.lon, EARTH_R + 0.005));
  
  const core = new THREE.Mesh(markerGeo, markerMat.clone());
  const glow = new THREE.Mesh(glowGeo, glowMat.clone());
  markerGroup.add(core); markerGroup.add(glow);
  
  const flagTex = loader.load(`https://flagcdn.com/w160/${loc.cCode}.png`);
  const flagMat = new THREE.SpriteMaterial({ map: flagTex, transparent: true });
  const flag = new THREE.Sprite(flagMat);
  flag.scale.set(0.08, 0.052, 1);
  flag.position.set(0, 0.035, 0); 
  markerGroup.add(flag);
  
  core.userData = { ...loc, flag: flag, glow: glow };
  earthGroup.add(markerGroup);
  interactionPoints.push(core);
});

earthGroup.rotation.y = -Math.PI / 1.5; 

// ─── GIAO DIỆN HUD ───
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:1000;';
hud.innerHTML = `
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    #uiOverlay_sci{font-family:'Share Tech Mono',monospace;color:#88ccff;pointer-events:auto;}
    .hud-panel{position:absolute;background:rgba(0,12,35,0.75);border:1px solid rgba(80,160,255,0.4);border-radius:6px;padding:15px;backdrop-filter:blur(8px);min-width:300px; max-width: 320px; box-shadow:0 4px 15px rgba(0,0,0,0.5);}
    .hud-title{font-size:14px;letter-spacing:1px;color:#33aaff;margin-bottom:12px;border-bottom:1px solid rgba(80,160,255,0.3);padding-bottom:6px;font-weight:bold;}
    .hud-item{font-size:12px;color:#bbddff;line-height:2.0;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);}
    .hud-stat{color:#fff;font-weight:bold;text-align:right;}
    .hud-desc-title{font-size:11px; color:#88eeff; margin-top:8px; margin-bottom: 2px;}
    .hud-desc-text{font-size:11.5px; line-height:1.4; color:#dddddd; min-height:48px;}
    .hud-cross{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;color:rgba(100,200,255,0.2);}
    
    input[type=range] { -webkit-appearance: none; width: 100%; background: rgba(80,160,255,0.2); height: 4px; border-radius: 2px; outline: none; margin-top: 8px; cursor: pointer; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #88eeff; border-radius: 50%; box-shadow: 0 0 8px #88eeff; cursor: pointer; }
  </style>
  <div id="uiOverlay_sci">
    <div class="hud-cross">✛</div>
    
    <div class="hud-panel" style="top:20px;left:20px;" id="hudCountryPanel">
      <div class="hud-title" id="hudTitle">GLOBAL VIEW</div>
      <div class="hud-item">POPULATION <span class="hud-stat" id="hudPop">--</span></div>
      <div class="hud-item">AREA <span class="hud-stat" id="hudArea">--</span></div>
      
      <div class="hud-desc-title">ECONOMY</div>
      <div class="hud-desc-text" id="hudEcon">--</div>
      
      <div class="hud-desc-title">CULTURE</div>
      <div class="hud-desc-text" id="hudCult">--</div>
    </div>

    <div class="hud-panel" style="bottom:20px;right:20px;min-width:180px;">
      <div class="hud-title" style="font-size:12px;">SATELLITE CONTROLS</div>
      <div class="hud-item">ALTITUDE <span class="hud-stat" id="hudAltitude">--</span></div>
      <div class="hud-item" style="border:none;">ZOOM <span class="hud-stat" id="hudZoom">--</span></div>
      
      <div style="margin-top:10px; border-top:1px solid rgba(80,160,255,0.3); padding-top:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#33aaff;">
          <span>EARTH ROTATION</span>
          <span id="speedVal" style="color:#fff; font-weight:bold;">1.0X</span>
        </div>
        <input type="range" id="rotSpeed" min="0" max="10" step="0.1" value="1">
      </div>
      
      <div style="margin-top:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#33aaff;">
          <span>SOLAR ORBIT</span>
          <span id="orbitSpeedVal" style="color:#fff; font-weight:bold;">1.0X</span>
        </div>
        <input type="range" id="orbitSpeed" min="0" max="10" step="0.1" value="1">
      </div>
    </div>
  </div>
`;
document.body.appendChild(hud);

let earthRotationSpeedMultiplier = 1.0;
document.getElementById('rotSpeed').addEventListener('input', (e) => {
  earthRotationSpeedMultiplier = parseFloat(e.target.value);
  document.getElementById('speedVal').textContent = earthRotationSpeedMultiplier === 0 ? 'PAUSED' : earthRotationSpeedMultiplier.toFixed(1) + 'X';
});

let earthOrbitSpeedMultiplier = 1.0;
document.getElementById('orbitSpeed').addEventListener('input', (e) => {
  earthOrbitSpeedMultiplier = parseFloat(e.target.value);
  document.getElementById('orbitSpeedVal').textContent = earthOrbitSpeedMultiplier === 0 ? 'PAUSED' : earthOrbitSpeedMultiplier.toFixed(1) + 'X';
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPoint = null;

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactionPoints);

  if (intersects.length > 0) {
    const point = intersects[0].object;
    if (hoveredPoint !== point) {
      if (hoveredPoint) {
        hoveredPoint.userData.flag.scale.set(0.08, 0.052, 1); 
        hoveredPoint.userData.glow.material.opacity = 0.2;
      }
      hoveredPoint = point;
      hoveredPoint.material.color.setHex(0x55ff55); 
      hoveredPoint.userData.flag.scale.set(0.12, 0.08, 1);
      hoveredPoint.userData.glow.material.color.setHex(0x55ff55);
      hoveredPoint.userData.glow.material.opacity = 0.5;
      
      document.body.style.cursor = 'pointer';
      document.getElementById('hudTitle').textContent = `${hoveredPoint.userData.name.toUpperCase()} [${hoveredPoint.userData.cCode.toUpperCase()}]`;
      document.getElementById('hudPop').textContent = hoveredPoint.userData.pop;
      document.getElementById('hudArea').textContent = hoveredPoint.userData.area;
      document.getElementById('hudEcon').textContent = hoveredPoint.userData.econ;
      document.getElementById('hudCult').textContent = hoveredPoint.userData.cult;
    }
  } else {
    if (hoveredPoint) {
      hoveredPoint.userData.flag.scale.set(0.08, 0.052, 1);
      hoveredPoint.userData.glow.material.opacity = 0.2;
      hoveredPoint = null;
      document.body.style.cursor = 'default';
      
      document.getElementById('hudTitle').textContent = 'GLOBAL VIEW';
      document.getElementById('hudPop').textContent = '--';
      document.getElementById('hudArea').textContent = '--';
      document.getElementById('hudEcon').textContent = '--';
      document.getElementById('hudCult').textContent = '--';
    }
  }
});

// ─── 8. ANIMATION LOOP (TÍCH HỢP JOYSTICK ĐIỀU KHIỂN VR) ────────
const clock = new THREE.Clock();
const BASE_ROTATION_SPEED = 0.03; 
const BASE_ORBIT_SPEED = 0.005; 

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  starUniforms.time.value = time;
  sunUniforms.time.value = time; 
  
  earthGroup.rotation.y += delta * BASE_ROTATION_SPEED * earthRotationSpeedMultiplier;
  clouds.rotation.y += delta * (BASE_ROTATION_SPEED + 0.01) * earthRotationSpeedMultiplier; 

  earthOrbitAngle += delta * BASE_ORBIT_SPEED * earthOrbitSpeedMultiplier; 
  earthGroup.position.x = Math.cos(earthOrbitAngle) * ORBIT_RADIUS;
  earthGroup.position.z = Math.sin(earthOrbitAngle) * ORBIT_RADIUS;

  const dx = earthGroup.position.x - previousEarthPosition.x;
  const dz = earthGroup.position.z - previousEarthPosition.z;
  
  // LOGIC ĐIỀU KHIỂN RIÊNG CHO MÔI TRƯỜNG VR
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes) {
          // Lấy giá trị gạt Joystick trái/phải (X) và Lên/xuống (Y)
          const stickX = source.gamepad.axes.length > 2 ? source.gamepad.axes[2] : source.gamepad.axes[0];
          const stickY = source.gamepad.axes.length > 3 ? source.gamepad.axes[3] : source.gamepad.axes[1];

          if (Math.abs(stickX) > 0.1) vrOrbitAngle -= stickX * 0.03; // Quét trái/phải quanh Trái Đất
          if (Math.abs(stickY) > 0.1) vrDistance += stickY * 0.05;   // Đẩy lên/xuống để Zoom in/out
        }
      }
    }
    
    // Giới hạn không cho camera đâm vào tâm Trái Đất hoặc bay quá xa
    vrDistance = THREE.MathUtils.clamp(vrDistance, 1.5, 12.0);

    // Tính toán tọa độ vệ tinh xoay quanh Trái Đất (Dolly)
    vrDolly.position.copy(earthGroup.position);
    vrDolly.rotation.y = vrOrbitAngle;
    vrCameraOffset.position.set(0, 0, vrDistance);

  } else {
    // Nếu chơi trên Desktop, dùng chuột bình thường
    camera.position.x += dx;
    camera.position.z += dz;
    controls.target.copy(earthGroup.position);
  }
  
  previousEarthPosition.copy(earthGroup.position);
  
  const cameraWorldPos = new THREE.Vector3();
  camera.getWorldPosition(cameraWorldPos);
  universeGroup.position.copy(cameraWorldPos);

  const sunDirW = sunGroup.position.clone().sub(earthGroup.position).normalize();
  const invN = new THREE.Matrix3().getNormalMatrix(earthGroup.matrixWorld).invert();
  const sunDirL = sunDirW.clone().applyMatrix3(invN).normalize();
  atmosMat.uniforms.sunDirection.value.copy(sunDirL);
  cityLightsMat.uniforms.sunDirection.value.copy(sunDirL);

  const earthWorldPos = new THREE.Vector3();
  earthGroup.getWorldPosition(earthWorldPos);

  interactionPoints.forEach(point => {
    if (point !== hoveredPoint) { 
      const pointWorldPos = new THREE.Vector3();
      point.getWorldPosition(pointWorldPos);
      
      const normal = pointWorldPos.clone().sub(earthWorldPos).normalize();
      const dot = normal.dot(sunDirW);
      
      if (dot < -0.1) {
        point.material.color.setHex(0xffffff); 
        point.userData.glow.material.color.setHex(0xcccccc); 
      } else {
        point.material.color.setHex(0xff3333); 
        point.userData.glow.material.color.setHex(0xffffff); 
      }
    }
  });

  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
  
  document.getElementById('hudAltitude').textContent = Number((camera.position.length() - 1) * 6371).toFixed(0) + ' KM';
  document.getElementById('hudZoom').textContent = Number(camera.position.length()).toFixed(1) + 'X';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});