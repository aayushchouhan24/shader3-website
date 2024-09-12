const textureLoader = new THREE.TextureLoader()
let analyser = null

function setupScene() {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 10000)
    camera.position.set(0, 0, 8)
    scene.add(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.body.append(renderer.domElement)

    return { scene, camera, renderer }
}

function shader3Material(uniforms) {
    const vertexShader = /*glsl*/ `
    ${Shader3.perlin}
    uniform float audioLevel;
    uniform float time;
    varying float height;

    void main() {
        float noiseFactor = perlin(s3_position  * 0.2) * 0.5;
        height = mix(noiseFactor * 2.0, perlin(s3_position + time) * audioLevel * 5.0, audioLevel);
        s3_position.y += height;
    }`

    const fragmentShader = /*glsl*/ `
    varying float height;
    uniform float audioLevel;
    void main() {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(height), height); 
        gl_FragColor.rgb = gl_FragColor.rgb+ vec3(height);
        gl_FragColor.rgb = gl_FragColor.rgb+audioLevel/2.;
    }`

    return new Shader3.MatcapShaderMaterial({ matcap: textureLoader.load("/assets/matcap3.png"), uniforms, vertexShader, fragmentShader, })
}

function createMesh(scene, material, uniforms, textureLoader) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material)
    mesh.customDepthMaterial = new Shader3.DepthShaderMaterial({ depthPacking: THREE.RGBADepthPacking, uniforms, vertexShader: material.vertexShader, })
    mesh.castShadow = true

    const texture = textureLoader.load("/assets/stars.jpg")
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.colourSpace = THREE.SRGBColorSpace

    const stars = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 64), new THREE.MeshStandardMaterial({ roughness: 0, side: 1, map: texture }))
    stars.receiveShadow = true
    scene.add(stars, mesh)

    return { mesh, stars }
}

function setupLighting(scene) {

    const radius = 5
    const angle1 = 0
    const angle2 = (2 * Math.PI) / 3
    const angle3 = (4 * Math.PI) / 3

    const lightGroup = new THREE.Group()

    const light = new THREE.DirectionalLight('#FF0000', radius)
    light.position.set(Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius)
    light.castShadow = true

    const light2 = new THREE.DirectionalLight('#0000FF', radius)
    light2.position.set(Math.cos(angle2) * radius, 0, Math.sin(angle2) * radius)
    light2.castShadow = true

    const light3 = new THREE.DirectionalLight('#00FF00', radius)
    light3.position.set(Math.cos(angle3) * radius, 0, Math.sin(angle3) * radius)
    light3.castShadow = true

    lightGroup.add(light, light2, light3)

    scene.add(lightGroup)

    return lightGroup
}

function setupAudio(listener, checkboxId) {
    const sound = new THREE.Audio(listener)
    const audioLoader = new THREE.AudioLoader()
    const bgmCheckbox = document.getElementById(checkboxId)
    let audioBuffer = null

    audioLoader.load('/assets/bgm.mp3', buffer => {
        audioBuffer = buffer
        analyser = new THREE.AudioAnalyser(sound, 512)
        bgmCheckbox.disabled = false
    })

    bgmCheckbox.addEventListener('change', e => handleAudioToggle(e.target.checked))

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            bgmCheckbox.checked = !bgmCheckbox.checked
            handleAudioToggle(bgmCheckbox.checked)
        }
    })

    function handleAudioToggle(isPlaying) {
        if (isPlaying && audioBuffer) {
            sound.setBuffer(audioBuffer)
            sound.setLoop(true)
            sound.setVolume(0.5)
            sound.play()
        } else if (!isPlaying) {
            sound.pause()
        }
    }
}


function handleResize(camera, renderer) {
    window.addEventListener("resize", () => {
        camera.aspect = innerWidth / innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(innerWidth, innerHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })
}

function handleMouseMovement() {
    const mouse = { x: 0, y: 0 }
    addEventListener("mousemove", (e) => {
        mouse.x = ((e.clientX / innerWidth) * 2 - 1) * 3
        mouse.y = (-(e.clientY / innerHeight) * 2 + 1) * 3
    })
    return mouse
}


function animate(clock, mesh, renderer, scene, camera, material, mouse, lights) {
    let cleared = true

    const loop = () => {
        const elapsedTime = clock.getElapsedTime()

        if (analyser) {
            const data = analyser.getFrequencyData()
            material.audioLevel = data.reduce((a, b) => a + b) / data.length / 256
            const lines = document.querySelectorAll('.bgm hr')
            const centerIndex = Math.floor(lines.length / 2)
            lines.forEach((load, index) => {
                const adjustedIndex = Math.abs(index - centerIndex)
                const frequency = data[adjustedIndex * Math.floor(data.length / lines.length)]
                const height = document.getElementById('bgm').checked ? Math.max(2, (frequency / 256) * 20 * (1 - adjustedIndex / centerIndex)) : 2
                load.style.height = `${height}px`
                const green = Math.floor(height * 5)
                const red = Math.max(0, (height - 10) * 25.5)
                const white = Math.max(0, 255 - green - red)
                load.style.borderLeft = `1px solid rgb(${red + white}, ${green + white}, ${white})`
            })
        }

        mesh.rotation.y = elapsedTime * 0.1
        mesh.position.set(
            THREE.MathUtils.lerp(mesh.position.x, -mouse.x, 0.001),
            THREE.MathUtils.lerp(mesh.position.y, mouse.y, 0.001),
            THREE.MathUtils.lerp(mesh.position.z, -mouse.x, 0.001)
        )

        lights.rotation.y += mouse.x * .001
        lights.rotation.x += mouse.y * .001

        material.time = elapsedTime

        camera.lookAt(mesh.position)
        renderer.render(scene, camera)
        requestAnimationFrame(loop)
    }

    loop()
}

function main() {
    const { scene, camera, renderer } = setupScene()

    const uniforms = { time: { value: 0 }, audioLevel: { value: 0 } }
    const material = shader3Material(uniforms)

    const listener = new THREE.AudioListener()
    camera.add(listener)

    setupAudio(listener, 'bgm')
    const { mesh } = createMesh(scene, material, uniforms, textureLoader)

    const lights = setupLighting(scene)
    handleResize(camera, renderer)
    const mouse = handleMouseMovement()

    const clock = new THREE.Clock()
    animate(clock, mesh, renderer, scene, camera, material, mouse, lights)
}

main()