import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.getElementById("orbitScene");
const canvas = document.getElementById("nvor3d");
const hero = stage?.closest(".hero-art");

if (stage && canvas && hero) {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
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
      "  for (int i = 0; i < 5; i++) {",
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
      "  vec2 flow = vec2(angle * 3.3 + uTime * 0.4 + uPhase, radius * 19.0 - uTime * 0.8);",
      "  float cloud = fbm(flow);",
      "  float turbulence = fbm(vec2(angle * 11.0 - uTime * 0.22 + cloud * 2.4, radius * 36.0 + uTime * 0.65));",
      "  float filament = pow(max(0.0, sin(angle * 27.0 + cloud * 7.0 - radius * 31.0 - uTime * 1.8 + uPhase)), 9.0);",
      "  float innerFade = smoothstep(0.0, 0.075, radius);",
      "  float outerFade = 1.0 - smoothstep(0.87, 1.0, radius);",
      "  float hue = fract(vUv.x * 0.72 + radius * 0.19 + turbulence * 0.2 + uPhase * 0.08 + uTime * 0.008);",
      "  vec3 color = spectrum(hue);",
      "  color = mix(color, vec3(0.08, 0.48, 0.98), smoothstep(0.18, 0.52, radius) * 0.52);",
      "  color = mix(color, vec3(0.88, 0.18, 0.67), smoothstep(0.48, 0.9, hue) * 0.45);",
      "  color = mix(color, vec3(0.87, 0.95, 1.0), (1.0 - smoothstep(0.0, 0.26, radius)) * 0.8);",
      "  float detail = 0.18 + cloud * 0.72 + turbulence * 0.42 + filament * 0.62;",
      "  float alpha = innerFade * outerFade * (0.28 + cloud * 0.42 + turbulence * 0.36 + filament * 0.42);",
      "  gl_FragColor = vec4(color * detail * 1.5, alpha);",
      "}",
    ].join("\n");

    const disks = [];
    [
      { inner: 0.72, outer: 2.82, phase: 0.0, z: -0.045, opacity: 1.0 },
      { inner: 0.82, outer: 2.54, phase: 2.4, z: 0.035, opacity: 0.68 },
    ].forEach((layer) => {
      const uniforms = {
        uTime: { value: 0 },
        uPhase: { value: layer.phase },
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
        makeDiskGeometry(layer.inner, layer.outer, 82, 440),
        material,
      );
      mesh.position.z = layer.z;
      diskGroup.add(mesh);
      disks.push({ material, speed: layer.phase === 0 ? 1 : 1.24 });
    });

    const dustCount = 720;
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
      new THREE.TorusGeometry(0.785, 0.018, 14, 320),
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
      new THREE.TorusGeometry(0.96, 0.004, 8, 320),
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

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let frame = 0;
    let paused = document.documentElement.classList.contains("motion-paused");
    let visible = !document.hidden;
    let previousTime = 0;
    let elapsed = 0;

    function resize() {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      dustMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      if (!frame) renderer.render(scene, camera);
    }

    function render(time) {
      frame = 0;
      if (paused || !visible) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      elapsed += delta;

      pointer.x += (targetPointer.x - pointer.x) * 0.045;
      pointer.y += (targetPointer.y - pointer.y) * 0.045;
      diskGroup.rotation.z = elapsed * 0.12 + pointer.x * 0.06;
      diskGroup.rotation.x = 1.07 - pointer.y * 0.08;
      diskGroup.rotation.y = -0.1 + pointer.x * 0.06;
      disks.forEach((disk) => {
        disk.material.uniforms.uTime.value = elapsed * disk.speed;
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
      if (!frame && !paused && visible) {
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
}

