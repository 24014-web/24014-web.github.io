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
      geometry.computeVertexNormals();
      return geometry;
    }

    const diskVertexShader = [
      "uniform float uTime;",
      "uniform float uPhase;",
      "varying vec2 vUv;",
      "varying float vAngle;",
      "void main() {",
      "  vec3 p = position;",
      "  float a = atan(p.y, p.x);",
      "  float r = length(p.xy);",
      "  float warp = sin(a * 2.0 - uTime * 0.9 + r * 3.4 + uPhase) * 0.055;",
      "  warp += sin(a * 7.0 + uTime * 0.56 + r * 8.0 + uPhase) * 0.018;",
      "  p.z += warp * (0.5 + vUv.y * 0.5);",
      "  vUv = uv;",
      "  vAngle = a;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
      "}",
    ].join("\n");

    const diskFragmentShader = [
      "precision highp float;",
      "uniform float uTime;",
      "uniform float uPhase;",
      "uniform float uOpacity;",
      "varying vec2 vUv;",
      "varying float vAngle;",
      "float hash(vec2 p) {",
      "  p = fract(p * vec2(123.34, 456.21));",
      "  p += dot(p, p + 45.32);",
      "  return fract(p.x * p.y);",
      "}",
      "float noise(vec2 p) {",
      "  vec2 i = floor(p);",
      "  vec2 f = fract(p);",
      "  f = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),",
      "    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);",
      "}",
      "float fbm(vec2 p) {",
      "  float value = 0.0;",
      "  float amplitude = 0.5;",
      "  for (int i = 0; i < 3; i++) {",
      "    value += noise(p) * amplitude;",
      "    p = p * 2.03 + vec2(17.1, 9.2);",
      "    amplitude *= 0.5;",
      "  }",
      "  return value;",
      "}",
      "vec3 spectrum(float t) {",
      "  return 0.52 + 0.48 * cos(6.2831853 * (t + vec3(0.0, 0.34, 0.67)));",
      "}",
      "void main() {",
      "  float angle = vUv.x * 6.2831853;",
      "  float radius = vUv.y;",
      "  vec2 flow = vec2(cos(angle * 3.0), sin(angle * 3.0)) * 3.3 + vec2(uTime * 0.4 + uPhase, radius * 19.0 - uTime * 0.8);",
      "  float cloud = fbm(flow);",
      "  vec2 turbulenceUv = vec2(cos(angle * 5.0), sin(angle * 5.0)) * 11.0 + vec2(-uTime * 0.22 + cloud * 2.4, radius * 36.0 + uTime * 0.65);",
      "  float turbulence = noise(turbulenceUv) * 0.68 + noise(turbulenceUv * 1.91 + 7.3) * 0.32;",
      "  float filament = pow(max(0.0, sin(angle * 27.0 + cloud * 7.0 - radius * 31.0 - uTime * 1.8 + uPhase)), 9.0);",
      "  float innerFade = smoothstep(0.0, 0.075, radius);",
      "  float outerFade = 1.0 - smoothstep(0.87, 1.0, radius);",
      "  float hue = fract(0.52 + sin(angle + radius * 2.4 + cloud * 1.9 - uTime * 0.07 + uPhase) * 0.19 + radius * 0.19 + turbulence * 0.17 + uPhase * 0.08 + uTime * 0.012);",
      "  vec3 color = spectrum(hue);",
      "  float chromaFlow = 0.5 + 0.5 * sin(angle * 2.0 - uTime * 0.35 + radius * 5.6 + cloud * 3.0 + turbulence * 2.0 + uPhase);",
      "  float blueFlow = 0.5 + 0.5 * sin(angle + uTime * 0.22 - radius * 3.4 + turbulence * 3.0 + uPhase);",
      "  color = mix(color, vec3(0.12, 0.42, 0.96), blueFlow * 0.24);",
      "  color = mix(color, vec3(0.92, 0.26, 0.76), (1.0 - blueFlow) * 0.13 + chromaFlow * 0.1);",
      "  color = mix(color, vec3(0.87, 0.95, 1.0), (1.0 - smoothstep(0.0, 0.26, radius)) * 0.8);",
      "  float detail = 0.18 + cloud * 0.72 + turbulence * 0.42 + filament * 0.62;",
      "  float alpha = innerFade * outerFade * (0.28 + cloud * 0.42 + turbulence * 0.36 + filament * 0.42);",
      "  gl_FragColor = vec4(color * detail * 1.18 * uOpacity, alpha * uOpacity);",
      "}",
    ].join("\n");

    const disks = [];
    [
      { inner: 0.72, outer: 2.82, phase: 0.0, z: -0.045, opacity: 0.78 },
      { inner: 0.82, outer: 2.54, phase: 2.4, z: 0.035, opacity: 0.58 },
    ].forEach((layer) => {
      const uniforms = {
        uTime: { value: 0 },
        uPhase: { value: layer.phase },
        uOpacity: { value: layer.opacity },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: diskVertexShader,
        fragmentShader: diskFragmentShader,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(
        makeDiskGeometry(layer.inner, layer.outer, 56, 280),
        material,
      );
      mesh.position.z = layer.z;
      diskGroup.add(mesh);
      disks.push({ material, speed: layer.phase === 0 ? 1 : 1.24 });
    });

    const dustCount = 420;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustPalette = [
      new THREE.Color(0x71deff),
      new THREE.Color(0xb9a1ff),
      new THREE.Color(0xff8cdb),
      new THREE.Color(0xeaf6ff),
    ];
    for (let i = 0; i < dustCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.93 + Math.random() * 2.08;
      const offset = i * 3;
      dustPositions[offset] = Math.cos(angle) * radius;
      dustPositions[offset + 1] = Math.sin(angle) * radius;
      dustPositions[offset + 2] = (Math.random() - 0.5) * 0.13;
      const color = dustPalette[Math.floor(Math.random() * dustPalette.length)];
      dustColors[offset] = color.r;
      dustColors[offset + 1] = color.g;
      dustColors[offset + 2] = color.b;
      dustSizes[i] = 0.025 + Math.random() * 0.052;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("aColor", new THREE.BufferAttribute(dustColors, 3));
    dustGeometry.setAttribute("aSize", new THREE.BufferAttribute(dustSizes, 1));
    const dustMaterial = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: [
        "attribute vec3 aColor;",
        "attribute float aSize;",
        "uniform float uPixelRatio;",
        "varying vec3 vColor;",
        "void main() {",
        "  vColor = aColor;",
        "  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
        "  gl_PointSize = aSize * uPixelRatio * 280.0 / max(1.0, -mvPosition.z);",
        "  gl_Position = projectionMatrix * mvPosition;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "precision highp float;",
        "varying vec3 vColor;",
        "void main() {",
        "  float edge = length(gl_PointCoord - vec2(0.5));",
        "  float alpha = 1.0 - smoothstep(0.08, 0.5, edge);",
        "  gl_FragColor = vec4(vColor * 1.4, alpha * 0.7);",
        "}",
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    diskGroup.add(dust);

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
      dustMaterial.uniforms.uPixelRatio.value = activePixelRatio;
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
        disk.material.uniforms.uTime.value = elapsed * disk.speed;
      });
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

