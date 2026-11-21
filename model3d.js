const stage = document.getElementById("orbitScene");
const canvas = document.getElementById("nvor3d");
const hero = stage?.closest(".hero-art");

if (stage && canvas && hero) {
  const initializeScene = async () => {
    try {
      const [THREE, { RoomEnvironment }] = await Promise.all([
        import("three"),
        import("three/addons/environments/RoomEnvironment.js"),
      ]);
    const compactDevice = window.matchMedia("(max-width: 720px)").matches;
    const lowPowerDevice = compactDevice
      || (navigator.hardwareConcurrency || 8) <= 4
      || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const maxPixelRatio = compactDevice ? 1 : lowPowerDevice ? 1.15 : 1.4;
    let pixelRatioLimit = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    let activePixelRatio = pixelRatioLimit;
    const minPixelRatio = compactDevice ? 0.72 : lowPowerDevice ? 0.78 : 0.86;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !compactDevice,
      powerPreference: lowPowerDevice ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(activePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x03030a, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0, 8.25);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    studio.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xbedfff, 0x090611, 0.7));

    const keyLight = new THREE.DirectionalLight(0xe8e8ff, 1.8);
    keyLight.position.set(-3.8, 4.8, 5.8);
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x39dfff, 52, 15, 2);
    cyanLight.position.set(3.5, 1.0, 2.6);
    scene.add(cyanLight);

    const roseLight = new THREE.PointLight(0xed51d0, 38, 15, 2);
    roseLight.position.set(-3.2, -0.7, 2.0);
    scene.add(roseLight);

    const violetLight = new THREE.PointLight(0x765cff, 42, 16, 2);
    violetLight.position.set(0.2, 3.6, -1.8);
    scene.add(violetLight);

    const diskGroup = new THREE.Group();
    diskGroup.rotation.set(1.07, -0.1, 0);
    scene.add(diskGroup);

    function makeDiskGeometry(innerRadius, outerRadius, radialSegments, angularSegments) {
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let radial = 0; radial <= radialSegments; radial += 1) {
        const t = radial / radialSegments;
        const radius = innerRadius + (outerRadius - innerRadius) * t;
        for (let angular = 0; angular <= angularSegments; angular += 1) {
          const angle = (angular / angularSegments) * Math.PI * 2;
          positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
          uvs.push(angular / angularSegments, t);
        }
      }

      for (let radial = 0; radial < radialSegments; radial += 1) {
        for (let angular = 0; angular < angularSegments; angular += 1) {
          const a = radial * (angularSegments + 1) + angular;
          const b = a + angularSegments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      return geometry;
    }

    const diskVertexShader = [
      "uniform float uTime;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec3 p = position;",
      "  float a = atan(p.y, p.x);",
      "  float r = length(p.xy);",
      "  float warp = sin(a * 2.0 - uTime * 0.9 + r * 3.4) * 0.012;",
      "  warp += sin(a * 7.0 + uTime * 0.56 + r * 8.0) * 0.004;",
      "  p.z += warp * (0.5 + uv.y * 0.5);",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
      "}",
    ].join("\n");

    function makeFlowNoiseTexture(size = 128) {
      const data = new Uint8Array(size * size * 4);
      const hash = (x, y) => {
        let value = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
        value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
        value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
        value = (value ^ (value >>> 16)) >>> 0;
        return value / 4294967295;
      };
      const wrap = (value, period) => ((value % period) + period) % period;
      const periodicNoise = (u, v, periodU, periodV) => {
        const x = u * periodU;
        const y = v * periodV;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const tx = x - x0;
        const ty = y - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = hash(wrap(x0, periodU), wrap(y0, periodV));
        const b = hash(wrap(x0 + 1, periodU), wrap(y0, periodV));
        const c = hash(wrap(x0, periodU), wrap(y0 + 1, periodV));
        const d = hash(wrap(x0 + 1, periodU), wrap(y0 + 1, periodV));
        return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
      };
      const octaveNoise = (u, v, baseU, baseV) => (
        periodicNoise(u, v, baseU, baseV) * 0.56
        + periodicNoise(u, v, baseU * 2, baseV * 2) * 0.29
        + periodicNoise(u, v, baseU * 4, baseV * 4) * 0.15
      );

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const u = x / size;
          const v = y / size;
          const offset = (y * size + x) * 4;
          data[offset] = Math.round(octaveNoise(u, v, 4, 4) * 255);
          data[offset + 1] = Math.round(octaveNoise(u, v, 8, 8) * 255);
          data[offset + 2] = Math.round(octaveNoise(u, v, 16, 16) * 255);
          data[offset + 3] = 255;
        }
      }

      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      return texture;
    }

    const flowNoiseTexture = makeFlowNoiseTexture();
    const diskFragmentShader = [
      "precision highp float;",
      "uniform float uTime;",
      "uniform float uOpacity;",
      "uniform sampler2D uFlowNoise;",
      "varying vec2 vUv;",
      "void main() {",
      "  float angle = vUv.x * 6.2831853;",
      "  float radius = vUv.y;",
      "  float orbitRate = 0.16 + 0.84 * pow(1.0 - radius, 1.5);",
      "  float flowAngle = angle - uTime * orbitRate;",
      "  vec2 flowUv = vec2(flowAngle / 6.2831853, radius);",
      "  vec3 broadNoise = texture2D(uFlowNoise, flowUv).rgb;",
      "  vec3 fineNoise = texture2D(uFlowNoise, flowUv * vec2(2.35, 1.85) + vec2(uTime * 0.009, -uTime * 0.016)).rgb;",
      "  float warp = (broadNoise.r - 0.5) * 3.1 + (fineNoise.g - 0.5) * 1.8;",
      "  float spiralA = sin(flowAngle * 4.2 + log(0.2 + radius * 0.8) * 6.4 + warp * 1.25);",
      "  float spiralB = sin(flowAngle * 7.0 - log(0.2 + radius * 0.8) * 4.2 + (broadNoise.g - 0.5) * 3.2 + uTime * 0.24);",
      "  float ribbonA = exp(-abs(spiralA) * 3.2);",
      "  float ribbonB = exp(-abs(spiralB) * 3.8);",
      "  float turbulence = broadNoise.r * 0.48 + broadNoise.g * 0.32 + fineNoise.b * 0.2;",
      "  float filaments = ribbonA * 0.68 + ribbonB * 0.32;",
      "  float heat = pow(1.0 - radius, 1.25);",
      "  float edgeFade = smoothstep(0.0, 0.035, radius) * (1.0 - smoothstep(0.88, 1.0, radius));",
      "  float innerRim = exp(-radius * 18.0);",
      "  float mass = 0.34 + turbulence * 0.6 + filaments * 0.5;",
      "  float emission = mass * (1.2 + heat * 2.2 + innerRim * 0.95);",
      "  float approaching = sin(angle);",
      "  vec3 color = mix(vec3(0.2, 0.15, 0.62), vec3(0.22, 0.48, 1.0), broadNoise.b * 0.72);",
      "  color = mix(color, vec3(0.62, 0.16, 0.58), smoothstep(0.12, 0.94, -approaching) * 0.46);",
      "  color = mix(color, vec3(0.58, 0.88, 1.0), smoothstep(-0.18, 0.82, approaching) * 0.5);",
      "  color = mix(color, vec3(0.9, 0.94, 1.0), (1.0 - smoothstep(0.0, 0.26, radius)) * 0.72);",
      "  float alpha = edgeFade * (0.34 + turbulence * 0.16 + filaments * 0.12);",
      "  gl_FragColor = vec4(color * emission * uOpacity, alpha * uOpacity);",
      "}",
    ].join("\n");

    const disks = [];
    [
      { inner: 0.72, outer: 2.82, z: -0.045, opacity: 0.96 },
    ].forEach((layer) => {
      const uniforms = {
        uTime: { value: 0 },
        uOpacity: { value: layer.opacity },
        uFlowNoise: { value: flowNoiseTexture },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: diskVertexShader,
        fragmentShader: diskFragmentShader,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(
        makeDiskGeometry(layer.inner, layer.outer, 56, 280),
        material,
      );
      mesh.position.z = layer.z;
      diskGroup.add(mesh);
      disks.push({ material });
    });

    const particleCount = compactDevice ? 8000 : lowPowerDevice ? 11000 : 15000;
    const innerParticleRadius = 0.88;
    const outerParticleRadius = 2.74;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleHeat = new Float32Array(particleCount);
    const particlePhases = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i += 1) {
      const offset = i * 3;
      const radialProgress = Math.pow(Math.random(), 1.7);
      const radius = innerParticleRadius + (outerParticleRadius - innerParticleRadius) * radialProgress;
      const useSpiralLane = Math.random() < 0.88;
      const lane = Math.floor(Math.random() * 5);
      const laneJitter = (Math.random() - 0.5) * (0.16 + radialProgress * 0.22);
      const angle = useSpiralLane
        ? lane * (Math.PI * 2 / 5) + radialProgress * 1.3 + laneJitter
        : Math.random() * Math.PI * 2;
      const heat = 1 - Math.sqrt(radialProgress);
      const height = (Math.random() - 0.5) * (0.018 + (1 - heat) * 0.032);
      const phase = Math.random() * Math.PI * 2;
      // Kepler-style angular acceleration is a visual cue; scene units are not a full GR simulation.
      const angularSpeed = Math.min(2.7, 2.55 * Math.pow(innerParticleRadius / radius, 1.5));
      particleSizes[i] = 0.075 + Math.random() * 0.045;
      particleSpeeds[i] = angularSpeed;
      particleHeat[i] = heat;
      particlePhases[i] = phase;
      // Pack radius, starting angle, and height into one attribute.
      particlePositions[offset] = radius;
      particlePositions[offset + 1] = angle;
      particlePositions[offset + 2] = height;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(particleSpeeds, 1));
    particleGeometry.setAttribute("aHeat", new THREE.BufferAttribute(particleHeat, 1));
    particleGeometry.setAttribute("aPhase", new THREE.BufferAttribute(particlePhases, 1));
    particleGeometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      outerParticleRadius + 0.18,
    );

    const particleUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: activePixelRatio },
      uViewport: { value: new THREE.Vector2(1, 1) },
    };
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      vertexShader: [
        "attribute float aSize;",
        "attribute float aSpeed;",
        "attribute float aHeat;",
        "attribute float aPhase;",
        "uniform float uTime;",
        "uniform float uPixelRatio;",
        "uniform vec2 uViewport;",
        "varying vec2 vDirection;",
        "varying vec3 vColor;",
        "varying float vHeat;",
        "varying float vDoppler;",
        "void main() {",
        "  float angle = position.y + uTime * aSpeed;",
        "  float radius = position.x;",
        "  float height = position.z + sin(uTime * 0.34 + aPhase) * 0.003;",
        "  vec3 orbitPosition = vec3(cos(angle) * radius, sin(angle) * radius, height);",
        "  vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);",
        "  vec4 mvPosition = modelViewMatrix * vec4(orbitPosition, 1.0);",
        "  vec4 clipPosition = projectionMatrix * mvPosition;",
        "  vec4 clipTangent = projectionMatrix * modelViewMatrix * vec4(orbitPosition + tangent * 0.035, 1.0);",
        "  vec2 tangentPixels = (clipTangent.xy / clipTangent.w - clipPosition.xy / clipPosition.w) * uViewport;",
        "  float tangentLength = length(tangentPixels);",
        "  vDirection = tangentLength > 0.00001 ? tangentPixels / tangentLength : vec2(1.0, 0.0);",
        "  vec3 tangentView = normalize(mat3(modelViewMatrix) * tangent);",
        "  float approaching = dot(tangentView, normalize(-mvPosition.xyz));",
        "  vHeat = aHeat;",
        "  vDoppler = clamp(1.0 + approaching * (0.1 + aHeat * 0.48), 0.62, 1.55);",
        "  vColor = mix(vec3(0.26, 0.22, 0.7), vec3(0.32, 0.7, 1.0), clamp(0.24 + aHeat * 0.64 + approaching * 0.16, 0.0, 1.0));",
        "  gl_PointSize = clamp(aSize * uPixelRatio * 330.0 * mix(0.82, 1.22, aHeat) / max(1.0, -mvPosition.z), 1.5, 5.5);",
        "  gl_Position = clipPosition;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "precision highp float;",
        "varying vec2 vDirection;",
        "varying vec3 vColor;",
        "varying float vHeat;",
        "varying float vDoppler;",
        "void main() {",
        "  vec2 point = gl_PointCoord * 2.0 - 1.0;",
        "  vec2 direction = normalize(vDirection);",
        "  vec2 normal = vec2(-direction.y, direction.x);",
        "  float along = dot(point, direction);",
        "  float across = abs(dot(point, normal));",
        "  float width = mix(0.1, 0.2, vHeat);",
        "  float acrossFade = 1.0 - smoothstep(width, width * 2.8, across);",
        "  float tailStart = smoothstep(-0.98, -0.42, along);",
        "  float tailEnd = 1.0 - smoothstep(0.34, 0.98, along);",
        "  float streak = acrossFade * tailStart * tailEnd * exp(-max(-along, 0.0) * 1.25);",
        "  float alpha = streak * (0.14 + vHeat * 0.1);",
        "  vec3 color = mix(vColor, vec3(0.72, 0.88, 1.0), clamp((vDoppler - 1.0) * 0.48, 0.0, 0.24));",
        "  gl_FragColor = vec4(color * streak * 0.48 * vDoppler, alpha);",
        "}",
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const accretionParticles = new THREE.Points(particleGeometry, particleMaterial);
    diskGroup.add(accretionParticles);

    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(0.715, 96, 72),
      new THREE.MeshBasicMaterial({ color: 0x000003, toneMapped: false }),
    );
    scene.add(horizon);

    const photonRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.785, 0.018, 10, 192),
      new THREE.MeshPhysicalMaterial({
        color: 0xe8e5ff,
        metalness: 0.74,
        roughness: 0.13,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        iridescence: 0.96,
        iridescenceThicknessMinimum: 220,
        iridescenceThicknessMaximum: 660,
        envMapIntensity: 2.0,
        emissive: 0x4f7fff,
        emissiveIntensity: 0.38,
      }),
    );
    scene.add(photonRing);

    const lensingHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 72, 56),
      new THREE.ShaderMaterial({
        vertexShader: [
          "varying vec3 vNormal;",
          "varying vec3 vView;",
          "void main() {",
          "  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
          "  vNormal = normalize(normalMatrix * normal);",
          "  vView = normalize(-mvPosition.xyz);",
          "  gl_Position = projectionMatrix * mvPosition;",
          "}",
        ].join("\n"),
        fragmentShader: [
          "precision highp float;",
          "varying vec3 vNormal;",
          "varying vec3 vView;",
          "void main() {",
          "  float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.5);",
          "  vec3 color = mix(vec3(0.12, 0.74, 1.0), vec3(0.75, 0.3, 1.0), rim);",
          "  gl_FragColor = vec4(color * 1.4, rim * 0.58);",
          "}",
        ].join("\n"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false,
      }),
    );
    scene.add(lensingHalo);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.004, 8, 192),
      new THREE.MeshBasicMaterial({
        color: 0x829cff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    outerRing.rotation.set(0.12, -0.2, 0);
    scene.add(outerRing);

    const liquidShaderCommon = [
      "uniform float uRippleTime;",
      "uniform float uRipplePhase;",
      "uniform float uRippleScale;",
      "uniform float uRippleStrength;",
      "varying float vLiquidGrain;",
      "float liquidHash(vec3 p) {",
      "  p = fract(p * 0.1031);",
      "  p += dot(p, p.yzx + 33.33);",
      "  return fract((p.x + p.y) * p.z);",
      "}",
      "float liquidNoise(vec3 p) {",
      "  vec3 i = floor(p);",
      "  vec3 f = fract(p);",
      "  f = f * f * (3.0 - 2.0 * f);",
      "  float n000 = liquidHash(i + vec3(0.0, 0.0, 0.0));",
      "  float n100 = liquidHash(i + vec3(1.0, 0.0, 0.0));",
      "  float n010 = liquidHash(i + vec3(0.0, 1.0, 0.0));",
      "  float n110 = liquidHash(i + vec3(1.0, 1.0, 0.0));",
      "  float n001 = liquidHash(i + vec3(0.0, 0.0, 1.0));",
      "  float n101 = liquidHash(i + vec3(1.0, 0.0, 1.0));",
      "  float n011 = liquidHash(i + vec3(0.0, 1.0, 1.0));",
      "  float n111 = liquidHash(i + vec3(1.0, 1.0, 1.0));",
      "  float z0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);",
      "  float z1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);",
      "  return mix(z0, z1, f.z);",
      "}",
      "float liquidFbm(vec3 p) {",
      "  float value = 0.0;",
      "  float amplitude = 0.5;",
      "  for (int i = 0; i < 3; i++) {",
      "    value += liquidNoise(p) * amplitude;",
      "    p = p * 2.03 + vec3(11.7, 7.3, 5.9);",
      "    amplitude *= 0.5;",
      "  }",
      "  return value;",
      "}",
      "float liquidHeight(vec3 p, float grain) {",
      "  vec3 q = p * uRippleScale;",
      "  float t = uRippleTime;",
      "  float broad = sin(dot(q, vec3(2.4, 3.1, 2.8)) + sin(q.z * 2.8 + q.x * 1.7 + t * 0.25) * 0.85 - t * 0.38 + uRipplePhase);",
      "  float fold = sin(q.y * 4.4 - q.z * 3.2 + grain * 3.0 + t * 0.42);",
      "  float ridge = 1.0 - abs(sin(q.x * 2.8 + q.y * 1.5 + q.z * 3.3 + grain * 2.2 + t * 0.24));",
      "  return uRippleStrength * (broad * 0.58 + fold * 0.22 + (grain - 0.5) * 0.34 + (ridge - 0.5) * 0.11);",
      "}",
    ].join("\n");

    const planetGeometry = new THREE.SphereGeometry(1, 48, 32);
    const planets = [];
    const planetSpecs = [
      { name: "Luma", radius: 1.52, size: 0.23, tiltX: 0.68, tiltY: 0.12, speed: 0.34, spin: 0.7, phase: 0.3, rippleScale: 3.2, rippleStrength: 0.066, color: 0x17151f, tint: 0xa78cff },
      { name: "Nyx", radius: 2.06, size: 0.255, tiltX: 1.22, tiltY: -0.35, speed: -0.255, spin: -0.56, phase: 2.2, rippleScale: 3.7, rippleStrength: 0.06, color: 0x171b23, tint: 0x7fe8ff },
      { name: "Veyra", radius: 2.54, size: 0.22, tiltX: 0.91, tiltY: 0.42, speed: 0.19, spin: 0.48, phase: 4.5, rippleScale: 3.45, rippleStrength: 0.07, color: 0x1b141e, tint: 0xf68bd6 },
    ];

    planetSpecs.forEach((spec, index) => {
      const orbit = new THREE.Group();
      scene.add(orbit);

      const pathMaterial = new THREE.MeshPhysicalMaterial({
        color: spec.tint,
        metalness: 0.82,
        roughness: 0.2,
        clearcoat: 0.9,
        clearcoatRoughness: 0.09,
        iridescence: 0.84,
        iridescenceThicknessMinimum: 200,
        iridescenceThicknessMaximum: 570,
        envMapIntensity: 1.5,
        emissive: spec.tint,
        emissiveIntensity: 0.06,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const path = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, index === 1 ? 0.003 : 0.0022, 8, 128),
        pathMaterial,
      );
      orbit.add(path);

      const rippleUniforms = {
        uRippleTime: { value: 0 },
        uRipplePhase: { value: spec.phase },
        uRippleScale: { value: spec.rippleScale },
        uRippleStrength: { value: spec.rippleStrength },
      };
      const material = new THREE.MeshPhysicalMaterial({
        color: spec.color,
        metalness: 0.94,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        reflectivity: 1,
        iridescence: 0.96,
        iridescenceIOR: 1.38,
        iridescenceThicknessMinimum: 250,
        iridescenceThicknessMaximum: 720,
        envMapIntensity: 1.3,
        emissive: spec.tint,
        emissiveIntensity: 0.012,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, rippleUniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\n" + liquidShaderCommon,
          )
          .replace(
            "#include <beginnormal_vertex>",
            [
              "#include <beginnormal_vertex>",
              "vec3 liquidN0 = normalize(objectNormal);",
              "vec3 liquidHelper = abs(liquidN0.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);",
              "vec3 liquidTangent = normalize(cross(liquidHelper, liquidN0));",
              "vec3 liquidBitangent = normalize(cross(liquidN0, liquidTangent));",
              "vec3 liquidFlow = position * uRippleScale * 1.65 + vec3(-uRippleTime * 0.14, uRippleTime * 0.12, uRipplePhase * 0.7);",
              "vLiquidGrain = liquidFbm(liquidFlow);",
              "float liquidEpsilon = 0.018;",
              "float liquidBaseHeight = liquidHeight(position, vLiquidGrain);",
              "float liquidSlopeT = (liquidHeight(position + liquidTangent * liquidEpsilon, vLiquidGrain) - liquidBaseHeight) / liquidEpsilon;",
              "float liquidSlopeB = (liquidHeight(position + liquidBitangent * liquidEpsilon, vLiquidGrain) - liquidBaseHeight) / liquidEpsilon;",
              "objectNormal = normalize(liquidN0 - liquidTangent * liquidSlopeT - liquidBitangent * liquidSlopeB);",
            ].join("\n"),
          )
          .replace(
            "#include <begin_vertex>",
            [
              "#include <begin_vertex>",
              "transformed += normalize(normal) * liquidHeight(position, vLiquidGrain);",
            ].join("\n"),
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\n" + liquidShaderCommon,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            [
              "#include <roughnessmap_fragment>",
              "float liquidMicrofold = vLiquidGrain;",
              "roughnessFactor = clamp(roughnessFactor + (liquidMicrofold - 0.5) * 0.055, 0.065, 0.2);",
            ].join("\n"),
          )
          .replace(
            "#include <opaque_fragment>",
            [
              "float liquidFacing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);",
              "float liquidFilmNoise = vLiquidGrain;",
              "float liquidGlint = pow(max(0.0, sin(liquidFilmNoise * 15.0 + uRippleTime * 0.3 + uRipplePhase)), 18.0);",
              "vec3 liquidFilmColor = 0.52 + 0.48 * cos(6.2831853 * (uRipplePhase + liquidFacing * 0.6 + liquidFilmNoise * 0.12 + vec3(0.0, 0.34, 0.67)));",
              "float liquidFilmMask = smoothstep(0.34, 0.94, liquidFacing) * (0.16 + liquidGlint * 0.84);",
              "outgoingLight = mix(outgoingLight, outgoingLight * 0.42 + liquidFilmColor * 0.62, liquidFilmMask * 0.36);",
              "outgoingLight += liquidFilmColor * liquidGlint * liquidFacing * 0.22;",
              "#include <opaque_fragment>",
            ].join("\n"),
          );
        material.userData.liquidShader = shader;
      };
      material.customProgramCacheKey = () => "nvor-liquid-chrome-orb-v1";
      material.userData.rippleUniforms = rippleUniforms;

      const body = new THREE.Mesh(planetGeometry, material);
      body.scale.setScalar(spec.size);
      body.position.set(spec.radius, 0, 0);
      orbit.add(body);
      planets.push({
        name: spec.name,
        group: orbit,
        path,
        body,
        material,
        spec,
        baseOpacity: pathMaterial.opacity,
      });
    });

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let selectedPlanet = -1;
    let frame = 0;
    let paused = document.documentElement.classList.contains("motion-paused");
    let visible = !document.hidden;
    const initialBounds = stage.getBoundingClientRect();
    let inView = initialBounds.bottom > 0 && initialBounds.top < window.innerHeight;
    let previousTime = 0;
    let elapsed = 0;
    let slowFrameCount = 0;
    let fastFrameCount = 0;

    document.querySelectorAll("[data-orb-focus]").forEach((card) => {
      const index = Number(card.dataset.orbFocus);
      card.addEventListener("pointerenter", () => {
        selectedPlanet = index;
      });
      card.addEventListener("pointerleave", () => {
        if (document.activeElement !== card) selectedPlanet = -1;
      });
      card.addEventListener("focus", () => {
        selectedPlanet = index;
      });
      card.addEventListener("blur", () => {
        if (!card.matches(":hover")) selectedPlanet = -1;
      });
    });

    function resize() {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const compact = window.matchMedia("(max-width: 720px)").matches;
      const lowPower = compact
        || (navigator.hardwareConcurrency || 8) <= 4
        || (navigator.deviceMemory && navigator.deviceMemory <= 4);
      const pixelRatioCeiling = Math.min(window.devicePixelRatio || 1, compact ? 1 : lowPower ? 1.15 : 1.4);
      pixelRatioLimit = pixelRatioCeiling;
      const nextPixelRatio = Math.min(activePixelRatio, pixelRatioCeiling);
      if (nextPixelRatio !== activePixelRatio) {
        activePixelRatio = nextPixelRatio;
        renderer.setPixelRatio(activePixelRatio);
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      particleUniforms.uPixelRatio.value = activePixelRatio;
      particleUniforms.uViewport.value.set(canvas.width, canvas.height);
      if (!frame && visible && inView) renderer.render(scene, camera);
    }

    function render(time) {
      frame = 0;
      if (paused || !visible || !inView) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      elapsed += delta;

      if (delta > 0.024) {
        slowFrameCount += 1;
        fastFrameCount = 0;
      } else if (delta > 0 && delta < 0.018) {
        fastFrameCount += 1;
        slowFrameCount = 0;
      } else {
        slowFrameCount = 0;
        fastFrameCount = 0;
      }
      if (slowFrameCount >= 10 && activePixelRatio > minPixelRatio) {
        activePixelRatio = Math.max(minPixelRatio, activePixelRatio - 0.14);
        renderer.setPixelRatio(activePixelRatio);
        slowFrameCount = 0;
      } else if (fastFrameCount >= 240 && activePixelRatio < pixelRatioLimit) {
        activePixelRatio = Math.min(pixelRatioLimit, activePixelRatio + 0.06);
        renderer.setPixelRatio(activePixelRatio);
        fastFrameCount = 0;
      }

      pointer.x += (targetPointer.x - pointer.x) * 0.045;
      pointer.y += (targetPointer.y - pointer.y) * 0.045;
      diskGroup.rotation.z = elapsed * 0.12 + pointer.x * 0.06;
      diskGroup.rotation.x = 1.07 - pointer.y * 0.08;
      diskGroup.rotation.y = -0.1 + pointer.x * 0.06;
      disks.forEach((disk) => {
        disk.material.uniforms.uTime.value = elapsed;
      });
      particleUniforms.uTime.value = elapsed;
      planets.forEach((planet, index) => {
        const { spec, group, body, material, path } = planet;
        group.rotation.set(
          spec.tiltX + pointer.y * 0.045,
          spec.tiltY + pointer.x * 0.035,
          spec.phase + elapsed * spec.speed,
        );
        body.rotation.set(elapsed * spec.spin, elapsed * spec.spin * -0.72, spec.phase * 0.16);
        material.userData.rippleUniforms.uRippleTime.value = elapsed * 0.82;
        const selected = index === selectedPlanet;
        const targetScale = spec.size * (selected ? 1.18 : 1.0);
        body.scale.x += (targetScale - body.scale.x) * 0.1;
        body.scale.y += (targetScale - body.scale.y) * 0.1;
        body.scale.z += (targetScale - body.scale.z) * 0.1;
        material.emissiveIntensity = selected ? 0.095 : 0.012;
        path.material.opacity = selected ? 0.42 : planet.baseOpacity;
        path.material.emissiveIntensity = selected ? 0.28 : 0.06;
      });

      keyLight.position.set(-3.8 + pointer.x * 2.8, 4.8 - pointer.y * 1.5, 5.8);
      cyanLight.position.set(3.5 - pointer.x * 1.2, 1.0 + Math.sin(elapsed * 0.4) * 0.7, 2.6);
      roseLight.position.set(-3.2 + Math.sin(elapsed * 0.28) * 0.5, -0.7 + pointer.y, 2.0);
      violetLight.position.set(Math.cos(elapsed * 0.24), 3.6, -1.8);
      photonRing.rotation.z = elapsed * -0.035;
      outerRing.rotation.z = elapsed * 0.018;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }

    function start() {
      if (!frame && !paused && visible && inView) {
        previousTime = 0;
        frame = requestAnimationFrame(render);
      }
    }

    function updateMotion(event) {
      paused = Boolean(event.detail?.paused);
      if (paused) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
        renderer.render(scene, camera);
      } else {
        start();
      }
    }

    hero.addEventListener("pointermove", (event) => {
      const bounds = hero.getBoundingClientRect();
      targetPointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      targetPointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    }, { passive: true });
    hero.addEventListener("pointerleave", () => {
      targetPointer.x = 0;
      targetPointer.y = 0;
    });
    window.addEventListener("motionstatechange", updateMotion);
    document.addEventListener("visibilitychange", () => {
      visible = !document.hidden;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        previousTime = 0;
      }
    });

    if ("IntersectionObserver" in window) {
      const sceneObserver = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView) {
          start();
        } else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
          previousTime = 0;
        }
      }, { threshold: 0.01 });
      sceneObserver.observe(stage);
    }

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(stage);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    resize();
    renderer.render(scene, camera);
    stage.classList.add("webgl-ready");
    window.dispatchEvent(new CustomEvent("nvor3dready"));
    start();
  } catch (error) {
    console.warn("NVOR black hole scene could not start; showing the animated fallback.", error);
  }
  };

  const startWhenReady = () => {
    if (document.hidden) {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) initializeScene();
      }, { once: true });
      return;
    }
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(initializeScene, { timeout: 1800 });
    } else {
      window.setTimeout(initializeScene, 180);
    }
  };

  if ("IntersectionObserver" in window) {
    const loadObserver = new IntersectionObserver((entries, observer) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        startWhenReady();
      }
    }, { rootMargin: "120px 0px", threshold: 0.01 });
    loadObserver.observe(stage);
  } else {
    startWhenReady();
  }
}

