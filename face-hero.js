import * as THREE from './assets/vendor/three.module.js';

const section = document.querySelector('.hero-scroll');
const stage = document.querySelector('#face-stage');
const canvas = document.querySelector('#neural-canvas');
const chapters = [...document.querySelectorAll('[data-face-phase]')];
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const descriptions = [
  ['The person.', 'Every system I build starts with a human question.'],
  ['Beneath the surface.', 'Appearance is only the beginning. The structure tells another story.'],
  ['The hidden structure.', 'My research finds the signals that synthetic media leaves behind.'],
  ['From face to fingerprint.', 'Turning complex patterns into trustworthy intelligence.']
];

let renderer, scene, camera, portrait, surface, wire, particles, orbit;
let progress = 0, displayProgress = 0, currentPhase = -1;
let stopped = motionQuery.matches, pointerX = 0, pointerY = 0, lookX = 0, lookY = 0;
let dragX = 0, dragging = false, lastX = 0, latestTime = 0, contextLost = false;
let surfaceUniforms, pointUniforms, wireMaterial;
const blinkUniform = { value: 0 };
const smileUniform = { value: 0 };
let nextBlink = 0, blinkStarted = null;

function updateBlink(time, inactive) {
  if (inactive) {
    blinkStarted = null;
    nextBlink = 0;
    blinkUniform.value = 0;
    return;
  }
  blinkUniform.value = 0;
  if (!nextBlink) nextBlink = time + 1800 + Math.random() * 2200;
  if (blinkStarted === null && time >= nextBlink) blinkStarted = time;
  if (blinkStarted !== null) {
    const elapsed = (time - blinkStarted) / 1000;
    // A quick closure, a brief closed lid, then a softer reopening.
    blinkUniform.value = smooth(0, .085, elapsed) * (1 - smooth(.115, .255, elapsed));
    if (elapsed >= .255) {
      blinkStarted = null;
      nextBlink = time + (Math.random() < .12 ? 220 : 3200 + Math.random() * 3200);
      blinkUniform.value = 0;
    }
  }
}

function eyelidTargets(data) {
  const targets = data.vertices.map(vertex => [...vertex]);
  const eyes = [
    { upper: [33, 246, 161, 160, 159, 158, 157, 173, 133], lower: [33, 7, 163, 144, 145, 153, 154, 155, 133], center: 468 },
    { upper: [263, 466, 388, 387, 386, 385, 384, 398, 362], lower: [263, 249, 390, 373, 374, 380, 381, 382, 362], center: 469 }
  ];
  for (const eye of eyes) {
    const seam = [];
    eye.upper.forEach((id, index) => {
      const upper = data.vertices[id], lower = data.vertices[eye.lower[index]];
      // The upper eyelid does most of the travel, as in a natural blink.
      const point = upper.map((value, axis) => value * .24 + lower[axis] * .76);
      targets[id] = [...point];
      targets[eye.lower[index]] = [...point];
      seam.push(point);
    });
    targets[eye.center] = seam[4].map((value, axis) => (value + seam[3][axis] + seam[5][axis]) / 3);
  }
  return targets;
}

function smileOffsets(data) {
  const mouthY = (data.vertices[13][1] + data.vertices[14][1]) / 2;
  const cornerX = (Math.abs(data.vertices[61][0]) + Math.abs(data.vertices[291][0])) / 2;
  return data.vertices.map(([x, y]) => {
    const corner = Math.exp(-Math.pow((Math.abs(x) - cornerX) / .23, 2) - Math.pow((y - mouthY) / .25, 2));
    const cheek = Math.exp(-Math.pow((Math.abs(x) - cornerX - .18) / .28, 2) - Math.pow((y - mouthY - .25) / .28, 2));
    // Keep the expression nearly neutral, with just a small corner lift.
    return [Math.sign(x) * .006 * corner, .022 * corner + .003 * cheek, .001 * cheek];
  });
}

function readProgress() {
  const rect = section.getBoundingClientRect();
  const travel = Math.max(1, section.offsetHeight - document.querySelector('.hero-sticky').offsetHeight);
  progress = clamp(-rect.top / travel);
  section.style.setProperty('--journey', progress.toFixed(4));
  const phase = Math.min(3, Math.floor(progress * 3.5));
  if (phase !== currentPhase) {
    currentPhase = phase;
    section.dataset.phase = String(phase);
    document.querySelector('#face-stage-name').textContent = descriptions[phase][0];
    document.querySelector('#face-stage-description').textContent = descriptions[phase][1];
    chapters.forEach((button, index) => button.setAttribute('aria-pressed', String(index === phase)));
  }
  if (stopped) render(latestTime, true);
}

function resize() {
  if (!renderer) return;
  const width = stage.clientWidth, height = stage.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // Keep the fitted face inside both narrow mobile and wide desktop views.
  camera.position.z = Math.max(7.95, 4.55 / camera.aspect);
  camera.updateProjectionMatrix();
  render(latestTime, stopped);
}

function render(time = 0, paused = stopped) {
  if (!renderer || contextLost) return;
  stopped = paused;
  latestTime = time;
  const reduce = motionQuery.matches;
  updateBlink(time, paused || reduce);
  displayProgress = paused || reduce ? progress : THREE.MathUtils.lerp(displayProgress, progress, .13);
  const p = displayProgress;
  smileUniform.value = smooth(.02, .20, p);
  blinkUniform.value = Math.max(blinkUniform.value, smooth(.05, .18, p));
  stage.dataset.blink = blinkUniform.value.toFixed(3);
  stage.dataset.smile = smileUniform.value.toFixed(3);
  stage.dataset.progress = p.toFixed(3);
  const idle = paused || reduce ? 0 : time * .0004;
  lookX = THREE.MathUtils.lerp(lookX, pointerX, .08);
  lookY = THREE.MathUtils.lerp(lookY, pointerY, .08);
  const turn = reduce ? -.09 : -.09 + Math.sin(p * Math.PI) * .38 + lookX * .10 + dragX;
  portrait.rotation.set(reduce ? 0 : lookY * .045 + Math.sin(idle) * .012, turn, reduce ? 0 : Math.sin(idle * .7) * .008);
  portrait.position.y = -.02 + (reduce ? 0 : Math.sin(idle * .7) * .028);
  const dissolve = smooth(.65, 1, p);
  surfaceUniforms.uSculpt.value = smooth(.09, .43, p);
  surfaceUniforms.uOpacity.value = 1 - smooth(.50, .76, p);
  surfaceUniforms.uTime.value = paused || reduce ? 0 : time * .001;
  surface.visible = surfaceUniforms.uOpacity.value > .005;
  wireMaterial.opacity = smooth(.27, .62, p) * .72 * (1 - smooth(.68, .94, p));
  wire.visible = wireMaterial.opacity > .01;
  pointUniforms.uDissolve.value = dissolve;
  pointUniforms.uOpacity.value = .05 + smooth(.45, .76, p) * .95;
  pointUniforms.uTime.value = paused || reduce ? 0 : time * .001;
  orbit.rotation.z = reduce ? 0 : p * .45 + idle * .07;
  orbit.rotation.y = reduce ? 0 : Math.sin(idle * .15) * .05;
  renderer.render(scene, camera);
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
    camera.position.z = 8.4;
    const [response, texture] = await Promise.all([
      fetch('./assets/shahid-face.json'),
      new THREE.TextureLoader().loadAsync('./uploads/profile.jpg')
    ]);
    if (!response.ok) throw new Error('Face surface could not load');
    const data = await response.json();
    const lidTargets = eyelidTargets(data);
    const smileDeltas = smileOffsets(data);
    texture.colorSpace = THREE.SRGBColorSpace;
    const vertices = data.vertices.flat(), uvs = data.uv.flat(), indices = [...data.triangles];
    // Make the normals face outward consistently on the reconstructed front surface.
    for (let i = 0; i < indices.length; i += 3) {
      const a = data.vertices[indices[i]], b = data.vertices[indices[i + 1]], c = data.vertices[indices[i + 2]];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('aLidTarget', new THREE.Float32BufferAttribute(lidTargets.flat(), 3));
    geometry.setAttribute('aSmileDelta', new THREE.Float32BufferAttribute(smileDeltas.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    surfaceUniforms = { uPortrait: { value: texture }, uSculpt: { value: 0 }, uOpacity: { value: 1 }, uTime: { value: 0 }, uBlink: blinkUniform, uSmile: smileUniform };
    const material = new THREE.ShaderMaterial({
      uniforms: surfaceUniforms, transparent: true, side: THREE.DoubleSide,
      vertexShader: `attribute vec3 aLidTarget; attribute vec3 aSmileDelta; uniform float uBlink; uniform float uSmile; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
        void main(){vUv=uv; vNormal=normalize(normalMatrix*normal); vec3 p=mix(position,aLidTarget,uBlink)+aSmileDelta*uSmile; vec4 mv=modelViewMatrix*vec4(p,1.0); vPosition=mv.xyz; gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D uPortrait; uniform float uSculpt; uniform float uOpacity; uniform float uTime;
        varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
        void main(){
          vec3 n=normalize(vNormal); vec3 view=normalize(-vPosition);
          vec3 photo=texture2D(uPortrait,vUv).rgb;
          float low=min(photo.r,min(photo.g,photo.b));
          float high=max(photo.r,max(photo.g,photo.b));
          bool boundary=vUv.x<0.34 || vUv.x>0.68 || vUv.y>0.66;
          if(boundary && low>0.32 && high-low<0.18)discard;
          float key=max(0.0,dot(n,normalize(vec3(-0.8,0.8,1.7))));
          float fill=max(0.0,dot(n,normalize(vec3(1.0,-0.1,1.0))));
          float rim=pow(1.0-max(0.0,dot(n,view)),2.8);
          vec3 sculpt=vec3(0.11,0.20,0.23)+key*vec3(0.27,0.40,0.43)+fill*vec3(0.10,0.14,0.15);
          float spec=pow(max(0.0,dot(reflect(-normalize(vec3(-0.8,0.8,1.7)),n),view)),32.0);
          sculpt+=spec*vec3(0.14,0.26,0.28)+rim*vec3(0.06,0.25,0.28);
          float luminance=dot(photo,vec3(0.2126,0.7152,0.0722));
          sculpt*=0.40+0.60*smoothstep(0.07,0.52,luminance);
          vec3 color=mix(photo*(0.84+key*0.17),sculpt,uSculpt);
          color+=rim*vec3(0.02,0.12,0.15)*(0.3+uSculpt);
          gl_FragColor=vec4(color,uOpacity);
          #include <colorspace_fragment>
        }`
    });
    portrait = new THREE.Group();
    portrait.position.y = -.02;
    scene.add(portrait);
    surface = new THREE.Mesh(geometry, material);
    portrait.add(surface);
    const wireGeometry = new THREE.WireframeGeometry(geometry);
    const key = vertex => vertex.map(value => value.toFixed(5)).join(',');
    const lidByPosition = new Map(data.vertices.map((vertex, index) => [key(vertex), lidTargets[index]]));
    const smileByPosition = new Map(data.vertices.map((vertex, index) => [key(vertex), smileDeltas[index]]));
    const wirePositions = wireGeometry.getAttribute('position');
    const wireLids = [], wireSmiles = [];
    for (let index = 0; index < wirePositions.count; index++) {
      const position = [wirePositions.getX(index), wirePositions.getY(index), wirePositions.getZ(index)];
      wireLids.push(...(lidByPosition.get(key(position)) || position));
      wireSmiles.push(...(smileByPosition.get(key(position)) || [0, 0, 0]));
    }
    wireGeometry.setAttribute('aLidTarget', new THREE.Float32BufferAttribute(wireLids, 3));
    wireGeometry.setAttribute('aSmileDelta', new THREE.Float32BufferAttribute(wireSmiles, 3));
    wireMaterial = new THREE.LineBasicMaterial({ color: 0x81e3e9, transparent: true, opacity: .06, depthWrite: false });
    wireMaterial.onBeforeCompile = shader => {
      shader.uniforms.uBlink = blinkUniform;
      shader.uniforms.uSmile = smileUniform;
      shader.vertexShader = 'attribute vec3 aLidTarget; attribute vec3 aSmileDelta; uniform float uBlink; uniform float uSmile;\n' + shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = mix(position, aLidTarget, uBlink) + aSmileDelta * uSmile;');
    };
    wire = new THREE.LineSegments(wireGeometry, wireMaterial);
    wire.scale.setScalar(1.002);
    portrait.add(wire);

    // Seed particles on the actual fitted triangles, preserving the facial silhouette.
    let seed = 88;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pointPositions = [], pointUvs = [], pointLids = [], pointSmiles = [], scatter = [], weights = [];
    const count = matchMedia('(max-width: 600px)').matches ? 2800 : 5200;
    for (let i = 0; i < count; i++) {
      const tri = Math.floor(random() * indices.length / 3) * 3;
      const ids = indices.slice(tri, tri + 3), r = Math.sqrt(random()), s = random();
      const weight = [1 - r, r * (1 - s), r * s];
      const p = [0, 0, 0], uv = [0, 0], lid = [0, 0, 0], smile = [0, 0, 0];
      ids.forEach((id, j) => { for (let k = 0; k < 3; k++) { p[k] += data.vertices[id][k] * weight[j]; lid[k] += lidTargets[id][k] * weight[j]; smile[k] += smileDeltas[id][k] * weight[j]; } for (let k = 0; k < 2; k++) uv[k] += data.uv[id][k] * weight[j]; });
      pointPositions.push(...p); pointUvs.push(...uv); pointLids.push(...lid); pointSmiles.push(...smile);
      const a = random() * Math.PI * 2, radius = 1 + random() * 1.3;
      scatter.push(Math.cos(a) * radius, (random() - .5) * 3, Math.sin(a) * radius * .7);
      weights.push(random());
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeometry.setAttribute('aLidTarget', new THREE.Float32BufferAttribute(pointLids, 3));
    pointGeometry.setAttribute('aSmileDelta', new THREE.Float32BufferAttribute(pointSmiles, 3));
    pointGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(pointUvs, 2));
    pointGeometry.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatter, 3));
    pointGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(weights, 1));
    pointUniforms = { uPortrait: { value: texture }, uDissolve: { value: 0 }, uOpacity: { value: .05 }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio || 1, 1.75) }, uBlink: blinkUniform, uSmile: smileUniform };
    const pointMaterial = new THREE.ShaderMaterial({
      uniforms: pointUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aScatter; attribute vec3 aLidTarget; attribute vec3 aSmileDelta; attribute float aSeed; uniform float uBlink; uniform float uSmile; uniform float uDissolve; uniform float uTime; uniform float uPixelRatio; varying vec2 vUv; varying float vSeed;
        void main(){vUv=uv;vSeed=aSeed;vec3 p=mix(position,aLidTarget,uBlink)+aSmileDelta*uSmile+aScatter*uDissolve;
          p.x+=sin(uTime*0.6+aSeed*16.0)*0.035*uDissolve;
          p.y+=cos(uTime*0.4+aSeed*13.0)*0.05*uDissolve;
          vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((1.1+aSeed*1.2)*uPixelRatio*(8.0/-mv.z),1.0,5.0);}`,
      fragmentShader: `uniform sampler2D uPortrait; uniform float uOpacity; uniform float uDissolve; varying vec2 vUv; varying float vSeed;
        void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;
          vec3 photo=texture2D(uPortrait,vUv).rgb;
          float low=min(photo.r,min(photo.g,photo.b));float high=max(photo.r,max(photo.g,photo.b));
          if((vUv.x<0.34 || vUv.x>0.68 || vUv.y>0.66) && low>0.32 && high-low<0.18)discard;
          vec3 color=mix(vec3(0.34,0.84,0.91),vec3(0.77,0.97,0.45),step(0.85,vSeed));
          color=mix(photo*0.8+color*0.4,color,0.7+uDissolve*0.3);
          gl_FragColor=vec4(color,uOpacity*(1.0-smoothstep(0.1,0.5,d)));}`
    });
    particles = new THREE.Points(pointGeometry, pointMaterial);
    particles.frustumCulled = false;
    portrait.add(particles);

    orbit = new THREE.Group();
    scene.add(orbit);
    [1, 1.22].forEach((scale, index) => {
      const points = [];
      for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * 1.82 * scale, Math.sin(a) * 2.18 * scale, -.9)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: index ? 0xc3f86a : 0x72dce7, transparent: true, opacity: index ? .08 : .12 }));
      line.rotation.z = index ? -.18 : .13;
      orbit.add(line);
    });
    stage.classList.add('face-ready');
    stage.dataset.renderer = 'webgl';
    window.faceHero = { render };
    readProgress();
    resize();
    new ResizeObserver(resize).observe(stage);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; stage.classList.remove('face-ready'); });
    canvas.addEventListener('webglcontextrestored', () => { contextLost = false; stage.classList.add('face-ready'); render(latestTime, stopped); });
  } catch (error) {
    renderer?.dispose();
    stage.dataset.renderer = 'portrait';
    stage.classList.add('face-unavailable');
    document.querySelector('#face-interaction-hint').textContent = 'THE HUMAN BEHIND THE RESEARCH';
    document.querySelector('#motion-toggle').hidden = true;
    console.warn('3D portrait fallback:', error.message);
  }
}

window.addEventListener('scroll', readProgress, { passive: true });
window.addEventListener('resize', readProgress, { passive: true });
document.addEventListener('portrait-motion', event => { stopped = event.detail.paused; render(latestTime, stopped); });
motionQuery.addEventListener('change', () => { stopped = motionQuery.matches; render(latestTime, stopped); });
stage.addEventListener('pointermove', event => {
  if (motionQuery.matches || stopped) return;
  const box = stage.getBoundingClientRect();
  pointerX = clamp((event.clientX - box.left) / box.width, 0, 1) * 2 - 1;
  pointerY = clamp((event.clientY - box.top) / box.height, 0, 1) * 2 - 1;
  if (dragging) { dragX = clamp(dragX + (event.clientX - lastX) * .003, -.38, .38); lastX = event.clientX; }
});
stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
canvas.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || stopped) return; dragging = true; lastX = event.clientX; canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-dragging'); });
const endDrag = () => { dragging = false; canvas.classList.remove('is-dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
chapters.forEach((button, index) => button.addEventListener('click', () => {
  const travel = section.offsetHeight - document.querySelector('.hero-sticky').offsetHeight;
  const top = scrollY + section.getBoundingClientRect().top;
  scrollTo({ top: top + travel * [0, .33, .61, .90][index], behavior: motionQuery.matches ? 'instant' : 'smooth' });
}));
document.querySelector('.scroll-invitation').addEventListener('click', event => {
  event.preventDefault();
  chapters[1].click();
});
readProgress();
init();
