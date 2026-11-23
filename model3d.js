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
    const maxPixelRatio = compactDevice ? 1.5 : lowPowerDevice ? 1.7 : 2.0;
    let activePixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(activePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x03030a, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0, 8.45);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    studio.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xbedfff, 0x090611, 0.7));

    const keyLight = new THREE.DirectionalLight(0xffead4, 3.2);
    keyLight.position.set(-3.8, 4.8, 5.8);
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x58e8ff, 68, 17, 2);
    cyanLight.position.set(3.5, 1.0, 2.6);
    scene.add(cyanLight);

    const roseLight = new THREE.PointLight(0xf27bdd, 52, 17, 2);
    roseLight.position.set(-3.2, -0.7, 2.0);
    scene.add(roseLight);

    const violetLight = new THREE.PointLight(0x9275ff, 48, 18, 2);
    violetLight.position.set(0.2, 3.6, -1.8);
    scene.add(violetLight);

    const diskGroup = new THREE.Group();
    diskGroup.rotation.set(1.48, -0.08, -0.1);
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
          const wave = Math.sin(angle * 2.0 + t * 4.0) * 0.004 + Math.sin(angle * 3.0 - t * 5.0) * 0.002;
          positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, wave * t);
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
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n");

    const diskFragmentShader = [
      "precision highp float;",
      "uniform float uTime;",
      "uniform float uOpacity;",
      "varying vec2 vUv;",
      "float hash31(vec3 p) {",
      "  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);",
      "}",
      "float noise3(vec3 p) {",
      "  vec3 i = floor(p);",
      "  vec3 f = fract(p);",
      "  f = f * f * (3.0 - 2.0 * f);",
      "  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));",
      "  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));",
      "  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));",
      "  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));",
      "  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));",
      "  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));",
      "  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));",
      "  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));",
      "  float x00 = mix(n000, n100, f.x);",
      "  float x10 = mix(n010, n110, f.x);",
      "  float x01 = mix(n001, n101, f.x);",
      "  float x11 = mix(n011, n111, f.x);",
      "  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);",
      "}",
      "float fbm(vec3 p) {",
      "  float value = 0.0;",
      "  float amplitude = 0.58;",
      "  for (int octave = 0; octave < 2; octave++) {",
      "    value += noise3(p) * amplitude;",
      "    p = p * 2.03 + vec3(13.7, 9.2, 7.1);",
      "    amplitude *= 0.42;",
      "  }",
      "  return value;",
      "}",
      "void main() {",
      "  float angle = vUv.x * 6.2831853;",
      "  float radius = vUv.y;",
      "  float innerShear = pow(1.0 - radius, 1.5);",
      "  float angularVelocity = 0.1 + innerShear * 0.95;",
      "  float orbitalPhase = angle - uTime * angularVelocity + log(0.16 + radius) * 0.82;",
      "  vec2 flowPosition = vec2(orbitalPhase * 0.86, log(0.12 + radius) * 1.38);",
      "  vec2 warp = vec2(fbm(vec3(flowPosition * vec2(0.38, 0.62), uTime * 0.018)), fbm(vec3(flowPosition * vec2(0.44, 0.52) + vec2(4.1, -2.7), -uTime * 0.016)));",
      "  vec2 flow = flowPosition + (warp - 0.5) * vec2(0.86, 0.34);",
      "  float cloud = fbm(vec3(flow * vec2(0.82, 0.7), uTime * 0.021));",
      "  float cloudShape = fbm(vec3(flow * vec2(1.24, 0.82) + vec2(1.9, -0.8), -uTime * 0.024));",
      "  float turbulence = cloud * 0.72 + cloudShape * 0.28;",
      "  float coherentFlow = smoothstep(0.2, 0.78, turbulence);",
      "  float innerLane = exp(-pow((radius - (0.105 + (cloud - 0.5) * 0.075)) * 5.0, 2.0));",
      "  float innerHeat = exp(-pow(radius / 0.16, 2.0));",
      "  float radialHeat = exp(-radius * 2.7);",
      "  float innerFade = smoothstep(0.0, 0.018, radius);",
      "  float outerFade = 1.0 - smoothstep(0.72, 1.0, radius);",
      "  float approachingSide = smoothstep(-0.5, 0.78, cos(angle - 0.3));",
      "  float doppler = mix(0.62, 1.0, approachingSide);",
      "  float density = (0.28 + coherentFlow * 0.72) * (0.54 + radialHeat * 0.46);",
      "  density *= mix(0.72, 1.0, cloudShape);",
      "  density *= innerFade * outerFade;",
      "  float heat = clamp(0.06 + radialHeat * 0.58 + innerHeat * 0.36 + coherentFlow * 0.18, 0.0, 1.0);",
      "  vec3 umber = vec3(0.032, 0.008, 0.004);",
      "  vec3 ember = vec3(0.32, 0.044, 0.009);",
      "  vec3 molten = vec3(0.78, 0.19, 0.035);",
      "  vec3 gold = vec3(1.0, 0.58, 0.23);",
      "  vec3 whiteHot = vec3(1.0, 0.93, 0.76);",
      "  vec3 color = mix(umber, ember, smoothstep(0.08, 0.48, heat + turbulence * 0.06));",
      "  color = mix(color, molten, smoothstep(0.28, 0.72, heat + innerLane * 0.12));",
      "  color = mix(color, gold, smoothstep(0.48, 0.84, heat + innerLane * 0.16));",
      "  color = mix(color, whiteHot, smoothstep(0.72, 1.0, innerHeat * 0.84 + innerLane * 0.18));",
      "  float emissive = doppler * (0.16 + radialHeat * 0.42 + innerHeat * 0.48 + innerLane * 0.24 + coherentFlow * 0.14);",
      "  float alpha = clamp(density * (0.24 + innerLane * 0.24 + innerHeat * 0.12) * uOpacity, 0.0, 0.48);",
      "  gl_FragColor = vec4(color * emissive * 1.45, alpha);",
      "}",
    ].join("\n");

    const disks = [];
    [
      { inner: 0.82, outer: 2.42, z: -0.045, opacity: 0.78 },
    ].forEach((layer) => {
      const uniforms = {
        uTime: { value: 0 },
        uOpacity: { value: layer.opacity },
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
        makeDiskGeometry(layer.inner, layer.outer, 48, 288),
        material,
      );
      mesh.position.z = layer.z;
      diskGroup.add(mesh);
      disks.push({ material });
    });

    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 112, 80),
      new THREE.MeshBasicMaterial({
        color: 0x01030a,
        transparent: false,
        depthWrite: true,
        toneMapped: false,
      }),
    );
    horizon.renderOrder = 5;
    scene.add(horizon);

    const lensRingVertexShader = [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n");
    const lensRingFragmentShader = [
      "precision highp float;",
      "uniform float uTime;",
      "uniform float uOpacity;",
      "varying vec2 vUv;",
      "float ringHash(vec3 p) {",
      "  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);",
      "}",
      "float ringNoise(vec3 p) {",
      "  vec3 i = floor(p);",
      "  vec3 f = fract(p);",
      "  f = f * f * (3.0 - 2.0 * f);",
      "  float n000 = ringHash(i);",
      "  float n100 = ringHash(i + vec3(1.0, 0.0, 0.0));",
      "  float n010 = ringHash(i + vec3(0.0, 1.0, 0.0));",
      "  float n110 = ringHash(i + vec3(1.0, 1.0, 0.0));",
      "  float n001 = ringHash(i + vec3(0.0, 0.0, 1.0));",
      "  float n101 = ringHash(i + vec3(1.0, 0.0, 1.0));",
      "  float n011 = ringHash(i + vec3(0.0, 1.0, 1.0));",
      "  float n111 = ringHash(i + vec3(1.0, 1.0, 1.0));",
      "  float z0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);",
      "  float z1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);",
      "  return mix(z0, z1, f.z);",
      "}",
      "void main() {",
      "  float around = vUv.x * 6.2831853;",
      "  float across = vUv.y * 2.0 - 1.0;",
      "  vec3 circle = vec3(cos(around), sin(around), 0.0);",
      "  float cloud = ringNoise(circle * 2.4 + vec3(0.0, 0.0, 1.7 + uTime * 0.07));",
      "  vec3 warpedCircle = vec3(cos(around + (cloud - 0.5) * 0.16), sin(around + (cloud - 0.5) * 0.16), 0.0);",
      "  float flow = ringNoise(warpedCircle * 4.8 + vec3(0.0, 0.0, -0.6 + uTime * 0.24));",
      "  float fineFlow = ringNoise(warpedCircle * 7.2 + vec3(0.0, 0.0, 2.2 - uTime * 0.16));",
      "  float turbulence = cloud * 0.56 + flow * 0.31 + fineFlow * 0.13;",
      "  float centerline = (cloud - 0.5) * 0.19 + (flow - 0.5) * 0.055;",
      "  float shoulder = exp(-pow((across - centerline) * 0.88, 2.0));",
      "  float broadBand = exp(-pow((across - centerline) * 1.62, 2.0));",
      "  float core = exp(-pow((across - centerline - (flow - 0.5) * 0.035) * 5.8, 2.0));",
      "  float innerFilament = exp(-pow((across + 0.46 - (fineFlow - 0.5) * 0.18) * 7.6, 2.0));",
      "  float outerFilament = exp(-pow((across - 0.43 - (flow - 0.5) * 0.16) * 7.5, 2.0));",
      "  float filaments = innerFilament * 0.4 + outerFilament * 0.34;",
      "  float hotClump = smoothstep(0.62, 0.9, turbulence) * smoothstep(0.05, 0.85, shoulder);",
      "  float doppler = 0.74 + 0.56 * smoothstep(-0.48, 0.68, cos(around - 2.86));",
      "  float edge = smoothstep(0.0, 0.27, 1.0 - abs(across));",
      "  float energy = mix(0.8, 1.0, smoothstep(0.12, 0.78, turbulence));",
      "  float heat = clamp(shoulder * 0.22 + broadBand * 0.22 + core * 0.43 + filaments * 0.56 + hotClump * 0.24, 0.0, 1.0);",
      "  vec3 color = mix(vec3(0.12, 0.025, 0.008), vec3(0.64, 0.16, 0.035), smoothstep(0.05, 0.5, heat));",
      "  color = mix(color, vec3(1.0, 0.52, 0.19), smoothstep(0.28, 0.78, heat));",
      "  color = mix(color, vec3(1.0, 0.9, 0.72), smoothstep(0.62, 0.98, core * 0.88 + hotClump * 0.14));",
      "  float radiance = (0.15 + shoulder * 0.54 + broadBand * 0.34 + core * 0.58 + filaments * 0.52 + hotClump * 0.34) * doppler * energy;",
      "  float alpha = edge * (0.08 + shoulder * 0.25 + broadBand * 0.2 + core * 0.32 + filaments * 0.21 + hotClump * 0.09) * uOpacity;",
      "  gl_FragColor = vec4(color * radiance * 1.7, alpha);",
      "}",
    ].join("\n");

    function makeLensingRingGeometry(majorRadius, ribbonWidth, segments = 480, crossSegments = 24) {
      const positions = [];
      const uvs = [];
      const indices = [];
      for (let around = 0; around <= segments; around += 1) {
        const u = (around / segments) * Math.PI * 2;
        const radiusWobble = Math.sin(u * 2.0 + 0.35) * 0.036 + Math.sin(u * 5.0 - 0.8) * 0.02 + Math.sin(u * 7.0 + 1.6) * 0.009;
        const localMajor = majorRadius + radiusWobble;
        const localWidth = ribbonWidth * (0.86 + Math.sin(u * 2.0 + 0.5) * 0.08 + Math.sin(u * 5.0 - 1.1) * 0.035);
        for (let cross = 0; cross <= crossSegments; cross += 1) {
          const t = cross / crossSegments;
          const radius = localMajor + (t - 0.5) * localWidth;
          positions.push(
            Math.cos(u) * radius,
            Math.sin(u) * radius,
            Math.sin(u * 2.0 + t * 3.2) * 0.026 + Math.sin(u * 5.0 - t * 4.0) * 0.014,
          );
          uvs.push(around / segments, t);
        }
      }
      for (let around = 0; around < segments; around += 1) {
        for (let cross = 0; cross < crossSegments; cross += 1) {
          const a = around * (crossSegments + 1) + cross;
          const b = a + crossSegments + 1;
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

    const lensRingMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.92 } },
      vertexShader: lensRingVertexShader,
      fragmentShader: lensRingFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const lensRing = new THREE.Mesh(
      makeLensingRingGeometry(1.08, 0.36),
      lensRingMaterial,
    );
    lensRing.position.z = -0.08;
    lensRing.renderOrder = 4;
    scene.add(lensRing);

    const beamFragmentShader = [
        "precision highp float;",
        "uniform float uTime;",
        "varying vec2 vUv;",
        "float beamHash(vec2 p) {",
        "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);",
        "}",
        "float beamNoise(vec2 p) {",
        "  vec2 i = floor(p);",
        "  vec2 f = fract(p);",
        "  f = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(beamHash(i), beamHash(i + vec2(1.0, 0.0)), f.x), mix(beamHash(i + vec2(0.0, 1.0)), beamHash(i + vec2(1.0, 1.0)), f.x), f.y);",
        "}",
        "void main() {",
        "  float along = vUv.x;",
        "  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);",
        "  float taper = smoothstep(0.0, 0.09, along) * (1.0 - smoothstep(0.84, 1.0, along));",
        "  float core = exp(-pow((1.0 - across) * 9.5, 2.0));",
        "  float shoulder = exp(-pow((1.0 - across) * 3.1, 2.0));",
        "  float hotCenter = exp(-pow((along - 0.24) * 3.3, 2.0));",
        "  float broadFlow = beamNoise(vec2(along * 4.4 - uTime * 0.035, 0.62)) * 0.26 + 0.72;",
        "  float flowCut = 0.9 + broadFlow * 0.1;",
        "  float body = smoothstep(0.0, 0.22, across) * taper;",
        "  float intensity = (0.12 + broadFlow * 0.1 + shoulder * 0.42 + core * 0.68 + hotCenter * core * 0.86) * flowCut;",
        "  vec3 color = mix(vec3(0.2, 0.036, 0.008), vec3(0.76, 0.2, 0.04), smoothstep(0.12, 0.62, intensity));",
        "  color = mix(color, vec3(1.0, 0.57, 0.22), smoothstep(0.38, 0.9, intensity));",
        "  color = mix(color, vec3(1.0, 0.93, 0.77), smoothstep(0.76, 1.45, core + hotCenter * core));",
        "  gl_FragColor = vec4(color * intensity * 1.78, body * (0.14 + shoulder * 0.23 + core * 0.48 + hotCenter * core * 0.16));",
        "}",
      ].join("\n");
    const streamMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: lensRingVertexShader,
      fragmentShader: beamFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mainStream = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 0.24, 1, 1), streamMaterial);
    mainStream.position.set(0, 0, -0.14);
    mainStream.rotation.z = -0.1;
    mainStream.renderOrder = 2;
    scene.add(mainStream);

    const beamMaterial = streamMaterial.clone();
    beamMaterial.depthTest = false;
    beamMaterial.uniforms.uTime.value = 0;
    const centralBeam = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.24, 1, 1), beamMaterial);
    centralBeam.position.set(0, 0, 0.75);
    centralBeam.rotation.z = -0.1;
    centralBeam.renderOrder = 6;
    scene.add(centralBeam);

    const crossingFlareMaterial = new THREE.ShaderMaterial({
      vertexShader: lensRingVertexShader,
      fragmentShader: [
        "precision highp float;",
        "varying vec2 vUv;",
        "void main() {",
        "  vec2 p = (vUv - 0.5) * 2.0;",
        "  float halo = exp(-pow(p.x * 2.8, 2.0) - pow(p.y * 4.4, 2.0));",
        "  float streak = exp(-pow(p.y * 12.0, 2.0)) * exp(-pow(p.x * 1.8, 2.0));",
        "  float core = exp(-pow(p.y * 22.0, 2.0) - pow(p.x * 2.3, 2.0));",
        "  vec3 color = mix(vec3(0.66, 0.17, 0.035), vec3(1.0, 0.76, 0.43), smoothstep(0.08, 0.82, halo + streak));",
        "  color = mix(color, vec3(1.0, 0.96, 0.84), smoothstep(0.28, 0.9, core));",
        "  float alpha = halo * 0.12 + streak * 0.18 + core * 0.14;",
        "  gl_FragColor = vec4(color * (halo * 0.28 + streak * 0.62 + core * 0.62), alpha);",
        "}",
      ].join("\n"),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const crossingFlare = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), crossingFlareMaterial);
    crossingFlare.position.set(-1.005, 0.105, 0.82);
    crossingFlare.rotation.z = -0.1;
    crossingFlare.renderOrder = 7;
    scene.add(crossingFlare);

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
      { name: "Luma", radius: 1.62, size: 0.24, tiltX: 0.4, tiltY: 0.12, speed: 0.34, spin: 0.7, phase: 0.35, rippleScale: 3.2, rippleStrength: 0.066, color: 0x393447, tint: 0xbba5ff },
      { name: "Nyx", radius: 2.2, size: 0.265, tiltX: 0.7, tiltY: -0.3, speed: -0.255, spin: -0.56, phase: 2.8, rippleScale: 3.7, rippleStrength: 0.06, color: 0x35414b, tint: 0x83eaff },
      { name: "Veyra", radius: 2.65, size: 0.23, tiltX: 0.48, tiltY: 0.42, speed: 0.19, spin: 0.48, phase: 5.1, rippleScale: 3.45, rippleStrength: 0.07, color: 0x40303f, tint: 0xff9cde },
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
        envMapIntensity: 1.8,
        emissive: spec.tint,
        emissiveIntensity: 0.06,
        transparent: true,
        opacity: 0.045,
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
        metalness: 0.84,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        reflectivity: 1,
        iridescence: 0.96,
        iridescenceIOR: 1.38,
        iridescenceThicknessMinimum: 250,
        iridescenceThicknessMaximum: 720,
        envMapIntensity: 2.0,
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
              "outgoingLight = mix(outgoingLight, outgoingLight * 0.34 + liquidFilmColor * 0.88, liquidFilmMask * 0.52);",
              "outgoingLight += liquidFilmColor * liquidFacing * (0.12 + liquidGlint * 0.42);",
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
      const atmosphere = new THREE.Mesh(
        planetGeometry,
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(spec.tint) } },
          vertexShader: [
            "varying vec3 vNormal;",
            "varying vec3 vViewDirection;",
            "void main() {",
            "  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);",
            "  vNormal = normalize(normalMatrix * normal);",
            "  vViewDirection = normalize(-viewPosition.xyz);",
            "  gl_Position = projectionMatrix * viewPosition;",
            "}",
          ].join("\n"),
          fragmentShader: [
            "uniform vec3 uColor;",
            "varying vec3 vNormal;",
            "varying vec3 vViewDirection;",
            "void main() {",
            "  float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 2.35);",
            "  float alpha = rim * 0.38;",
            "  gl_FragColor = vec4(uColor * (0.35 + rim * 1.2), alpha);",
            "}",
          ].join("\n"),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.FrontSide,
          toneMapped: false,
        }),
      );
      atmosphere.scale.setScalar(spec.size * 1.12);
      atmosphere.position.copy(body.position);
      orbit.add(atmosphere);
      planets.push({
        name: spec.name,
        group: orbit,
        path,
        body,
        atmosphere,
        material,
        spec,
        baseOpacity: pathMaterial.opacity,
      });
    });

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let selectedPlanet = -1;
    let pinnedPlanet = -1;
    let frame = 0;
    let paused = document.documentElement.classList.contains("motion-paused");
    let visible = !document.hidden;
    const initialBounds = stage.getBoundingClientRect();
    let inView = initialBounds.bottom > 0 && initialBounds.top < window.innerHeight;
    let previousTime = 0;
    let elapsed = 0;

    document.querySelectorAll("[data-orb-focus]").forEach((card) => {
      const index = Number(card.dataset.orbFocus);
      card.addEventListener("pointerenter", () => {
        selectedPlanet = index;
      });
      card.addEventListener("pointerleave", () => {
        if (!card.matches(":focus-within")) selectedPlanet = pinnedPlanet;
      });
      card.addEventListener("focusin", () => {
        selectedPlanet = index;
      });
      card.addEventListener("focusout", () => {
        if (!card.matches(":hover")) selectedPlanet = pinnedPlanet;
      });
    });

    document.querySelectorAll("[data-orb-pin]").forEach((button) => {
      const index = Number(button.dataset.orbPin);
      button.addEventListener("click", () => {
        pinnedPlanet = pinnedPlanet === index ? -1 : index;
        selectedPlanet = pinnedPlanet;
        document.querySelectorAll("[data-orb-pin]").forEach((candidate) => {
          candidate.setAttribute("aria-pressed", String(Number(candidate.dataset.orbPin) === pinnedPlanet));
        });
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
      const pixelRatioCeiling = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : lowPower ? 1.7 : 2.0);
      const nextPixelRatio = pixelRatioCeiling;
      if (nextPixelRatio !== activePixelRatio) {
        activePixelRatio = nextPixelRatio;
        renderer.setPixelRatio(activePixelRatio);
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!frame && visible && inView) renderer.render(scene, camera);
    }

    function render(time) {
      frame = 0;
      if (paused || !visible || !inView) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      elapsed += delta;

      pointer.x += (targetPointer.x - pointer.x) * 0.045;
      pointer.y += (targetPointer.y - pointer.y) * 0.045;
      diskGroup.rotation.z = -0.1 + Math.sin(elapsed * 0.08) * 0.008;
      diskGroup.rotation.x = 1.48 - pointer.y * 0.012;
      diskGroup.rotation.y = -0.08 + pointer.x * 0.022;
      camera.position.x += (pointer.x * 0.09 - camera.position.x) * 0.025;
      camera.position.y += (pointer.y * -0.08 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);
      disks.forEach((disk) => {
        disk.material.uniforms.uTime.value = elapsed;
      });
      planets.forEach((planet, index) => {
        const { spec, group, body, atmosphere, material, path } = planet;
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
        atmosphere.scale.setScalar(body.scale.x * 1.12);
        material.emissiveIntensity = selected ? 0.095 : 0.012;
        path.material.opacity = selected ? 0.22 : planet.baseOpacity;
        path.material.emissiveIntensity = selected ? 0.12 : 0.02;
      });

      keyLight.position.set(-3.8 + pointer.x * 2.8, 4.8 - pointer.y * 1.5, 5.8);
      cyanLight.position.set(3.5 - pointer.x * 1.2, 1.0 + Math.sin(elapsed * 0.4) * 0.7, 2.6);
      roseLight.position.set(-3.2 + Math.sin(elapsed * 0.28) * 0.5, -0.7 + pointer.y, 2.0);
      violetLight.position.set(Math.cos(elapsed * 0.24), 3.6, -1.8);
      lensRingMaterial.uniforms.uTime.value = elapsed * 0.75;
      streamMaterial.uniforms.uTime.value = elapsed * 0.65;
      beamMaterial.uniforms.uTime.value = elapsed * 0.65;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }

    function start() {
      if (!frame && !paused && visible && inView) {
        previousTime = 0;
        frame = requestAnimationFrame(render);
      }
    }

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      stage.classList.remove("webgl-ready");
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      resize();
      renderer.render(scene, camera);
      stage.classList.add("webgl-ready");
      start();
    });

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

