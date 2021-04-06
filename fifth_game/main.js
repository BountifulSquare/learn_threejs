import * as THREE from '../build/three.module.js'
import { GLTFLoader } from '../build/GLTFLoader.js'
import { SkeletonUtils } from '../build/SkeletonUtils.js'
import { BufferGeometryUtils } from '../build/BufferGeometryUtils.js'

function setup() {
    const canvas = document.querySelector('#canvas')
    const { clientWidth: w, clientHeight: h } = canvas
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true

    const ambientLight = new THREE.AmbientLight(0xF2F2F2, 0.2)
    const hemiLight = new THREE.HemisphereLight(0x0463CA, 0x684132, 0.1)

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshPhongMaterial({ color: 0xE9CCAF })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xC4EEF8)
    scene.fog = new THREE.Fog(scene.background, 1, 200)
    scene.add(ambientLight)
    scene.add(hemiLight)
    scene.add(ground)

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 500)
    camera.position.set(0, 10, -10)
    camera.lookAt(0, 0, 0)

    return {
        renderer,
        scene,
        camera
    }
}

class Input {
    constructor() {
        this._forward = false
        this._backward = false
        this._right = false
        this._left = false

        document.addEventListener('keydown', (e) => this._onKeyDown(e))
        document.addEventListener('keyup', (e) => this._onKeyUp(e))
    }

    _onKeyDown(e) {
        if (e.code === 'KeyW') {
            this._forward = true
        }
        if (e.code === 'KeyS') {
            this._backward = true
        }
        if (e.code === 'KeyD') {
            this._right = true
        }
        if (e.code === 'KeyA') {
            this._left = true
        }
    }

    _onKeyUp(e) {
        if (e.code === 'KeyW') {
            this._forward = false
        }
        if (e.code === 'KeyS') {
            this._backward = false
        }
        if (e.code === 'KeyD') {
            this._right = false
        }
        if (e.code === 'KeyA') {
            this._left = false
        }
    }
}

class FollowLight {
    constructor(target) {
        this._target = target

        this._light = new THREE.DirectionalLight(0xF5F5F5, 0.9)
        this._light.position.set(5, 10, 5)
        this._light.target = target
        this._light.castShadow = true

        this._light.shadow.mapSize.width = 2048
        this._light.shadow.mapSize.height = 2048
        this._light.shadow.camera.left = -30
        this._light.shadow.camera.right = 30
        this._light.shadow.camera.top = 40
        this._light.shadow.camera.bottom = -40

        this._helper = new THREE.CameraHelper(this._light.shadow.camera)
    }

    getFollowLight() {
        return this._light
    }

    getFollowLightHelper() {
        return this._helper
    }

    _calculateIdealOffset() {
        const offset = new THREE.Vector3(5, 30, 5)
        offset.add(this._target.position.clone())
        return offset
    }

    update() {
        const idealOffset = this._calculateIdealOffset()
        this._light.position.copy(idealOffset)
    }
}

class FollowCamera {
    constructor(camera, target) {
        this._camera = camera
        this._target = target

        this._idealOffset = new THREE.Vector3()
        this._idealLookAt = new THREE.Vector3()

        this._click = false
        document.addEventListener('pointerdown', () => this._pointerDown())
        document.addEventListener('pointerup', () => this._pointerUp())
    }

    _pointerDown() {
        this._click = true
    }

    _pointerUp() {
        this._click = false
    }

    _calculateIdealOffset() {
        const offset = new THREE.Vector3(0, 15, -25)
        offset.applyEuler(this._target.rotation)
        offset.add(this._target.position)
        return offset
    }

    _calculateIdealLookAt() {
        const lookAt = new THREE.Vector3(0, 0, 10)
        lookAt.applyEuler(this._target.rotation)
        lookAt.add(this._target.position)
        return lookAt
    }

    update(dt) {
        const idealOffset = this._calculateIdealOffset()
        const idealLookAt = this._calculateIdealLookAt()
        const t = 1 - Math.pow(0.001, dt)

        this._idealOffset.lerp(idealOffset, t)
        this._idealLookAt.lerp(idealLookAt, t)

        this._camera.position.copy(this._idealOffset)
        this._camera.lookAt(this._idealLookAt)
    }
}

class FiniteStateMachine {
    constructor() {
        this._states = {}
        this._currentState = null
    }

    _addState(name, type) {
        this._states[name] = type
    }

    setState(name) {
        const prevState = this._currentState

        if (prevState) {
            if (prevState.name === name) {
                return
            }
            prevState.exit()
        }

        const state = new this._states[name](this)

        this._currentState = state
        state.enter(prevState)
    }

    update(dt, input) {
        if (this._currentState) {
            this._currentState.update(dt, input)
        }
    }
}

class CharacterFSM extends FiniteStateMachine {
    constructor(proxy) {
        super()
        this._proxy = proxy
        this._init()
    }

    _init() {
        this._addState('Idle', Idle)
        this._addState('Run', Run)
        this._addState('WalkBackward', WalkBackward)
    }
}

class State {
    constructor(parent) {
        this._parent = parent
    }

    enter() { }
    exit() { }
    update() { }
}

class Idle extends State {
    constructor(parent) {
        super(parent)
    }

    get Name() {
        return 'Idle'
    }

    enter(prevState) {
        const currAction = this._parent._proxy._animations['Idle'].action

        if (prevState) {
            const prevAction = this._parent._proxy._animations[prevState.Name].action
            prevAction.fadeOut(0.25)

            currAction
                .reset()
                .fadeIn(0.25)
                .play()
        } else {
            currAction.play()
        }
    }

    update(dt, input) {
        if (input._forward) {
            this._parent.setState('Run')
        }
        if (input._backward) {
            this._parent.setState('WalkBackward')
        }
    }
}

class Run extends State {
    constructor(parent) {
        super(parent)
    }

    get Name() {
        return 'Run'
    }

    enter(prevState) {
        const currAction = this._parent._proxy._animations['Run'].action

        if (prevState) {
            const prevAction = this._parent._proxy._animations[prevState.Name].action
            prevAction.fadeOut(0.25)

            currAction
                .reset()
                .fadeIn(0.25)
                .play()
        } else {
            currAction.play()
        }
    }

    update(dt, input) {
        if (!input._forward) {
            this._parent.setState('Idle')
        }
    }
}

class WalkBackward extends State {
    constructor(parent) {
        super(parent)
    }

    get Name() {
        return 'WalkBackward'
    }

    enter(prevState) {
        const currAction = this._parent._proxy._animations['WalkBackward'].action

        if (prevState) {
            const prevAction = this._parent._proxy._animations[prevState.Name].action
            prevAction.fadeOut(0.25)

            currAction
                .reset()
                .fadeIn(0.25)
                .play()
        } else {
            currAction.play()
        }
    }

    update(dt, input) {
        if (!input._backward) {
            this._parent.setState('Idle')
        }
    }
}

class PlayerControllerProxy {
    constructor(animations) {
        this._animations = animations
    }

    get animations() {
        return this._animations
    }
}

class Player {
    constructor() {
        this._player

        this._input = new Input()
        this._runSpeed = 10
        this._backwardSpeed = 5
        this._angle = THREE.MathUtils.degToRad(75)

        this._fRay
        this._bRay
        this._rayOrigin
        this._fRayDir = new THREE.Vector3(0, 0, 1)
        this._bRayDir = new THREE.Vector3(0, 0, -1)

        this._yAxis = new THREE.Vector3(0, 1, 0)
        this._fBump = false
        this._bBump = false

        this._mixer
        this._animations = {}
        this._stateMachine = new CharacterFSM(new PlayerControllerProxy(this._animations))

        this._box3 = new THREE.Box3()
        this._box3Helper = new THREE.Box3Helper(this._box3)
    }

    init(scene) {
        return new Promise(resolve => {
            const loader = new GLTFLoader()
            loader.load('../assets/yBot.glb', (model) => {
                this._player = model.scene
                this._player.scale.set(2, 2, 2)
                this._player.traverse(obj => {
                    if (obj.isMesh) {
                        obj.castShadow = true
                    }
                })

                const load = (name) => {
                    const clip = THREE.AnimationClip.findByName((model.animations), name)
                    const action = this._mixer.clipAction(clip)

                    this._animations[name] = {
                        clip,
                        action
                    }
                }

                this._mixer = new THREE.AnimationMixer(this._player)
                load('Idle')
                load('Run')
                load('WalkBackward')
                this._stateMachine.setState('Idle')

                this._rayOrigin = this._player.position
                this._fRay = new THREE.Raycaster(this._rayOrigin, this._fRayDir, 0, 2)
                this._bRay = new THREE.Raycaster(this._rayOrigin, this._bRayDir, 0, 2)

                scene.add(this._player)
                // scene.add(this._box3Helper)
                resolve()
            })
        })
    }

    getPlayer() {
        return this._player
    }

    getBox3() {
        return this._box3
    }

    _transform(dt) {
        if (this._input._forward && !this._fBump) {
            this._player.translateZ(this._runSpeed * dt)
        }
        if (this._input._backward && !this._bBump) {
            this._player.translateZ(-this._backwardSpeed * dt)
        }
        if (this._input._right) {
            const angle = -this._angle * dt
            this._player.rotateY(angle)
            this._fRayDir.applyAxisAngle(this._yAxis, angle)
            this._bRayDir.applyAxisAngle(this._yAxis, angle)
        }
        if (this._input._left) {
            const angle = this._angle * dt
            this._player.rotateY(angle)
            this._fRayDir.applyAxisAngle(this._yAxis, angle)
            this._bRayDir.applyAxisAngle(this._yAxis, angle)
        }
    }

    _calculateBox3() {
        const coef = new THREE.Vector3(0, 2, 0)
        const size = new THREE.Vector3(1, 4, 1)
        const center = coef.add(this._player.position.clone())
        this._box3.setFromCenterAndSize(center, size)
    }

    update(dt) {
        this._transform(dt)
        this._calculateBox3()
        this._stateMachine.update(dt, this._input)
        this._mixer.update(dt)
    }

    collision(obj) {
        const fCollide = this._fRay.intersectObject(obj)
        if (fCollide.length === 0 && this._fBump === true) {
            this._fBump = false
        }
        for (let f of fCollide) {
            if (f.distance < 1.5) {
                this._fBump = true
            }
        }

        const bCollide = this._bRay.intersectObject(obj)
        if (bCollide.length === 0 && this._bBump === true) {
            this._bBump = false
        }
        for (let b of bCollide) {
            this._bBump = true
        }
    }
}

class Chicken {
    constructor(chicken, animations, posX, posZ) {
        this._chicken = chicken
        this._chicken.position.set(posX, 0.5, posZ)
        this._chicken.scale.set(0.25, 0.25, 0.25)

        this._animations = animations
        this._mixer = new THREE.AnimationMixer(this._chicken)
        this._box3 = new THREE.Box3()
        this._box3Helper = new THREE.Box3Helper(this._box3)

        this._delay = 0
    }

    init(scene) {
        scene.add(this._chicken)
        // scene.add(this._box3Helper)

        this._chicken.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true
            }
        })

        const clip = this._animations[0]
        const action = this._mixer.clipAction(clip)
        action.play()
    }

    _calculateBox3() {
        if (this._chicken) {
            const center = new THREE.Vector3(0, 0.25, 0)
            center.add(this._chicken.position.clone())
            const size = new THREE.Vector3(1, 1, 1)
            this._box3.setFromCenterAndSize(center, size)
        }
    }

    update(dt) {
        this._calculateBox3()
        this._mixer.update(dt)
    }

    collision(box, scene) {
        if (this._box3.intersectsBox(box)) {
            this._delay++

            if (this._delay > 10) {
                this._box3.makeEmpty()
                this._chicken.traverse(obj => {
                    if (obj.isMesh) {
                        obj.geometry.dispose()
                        obj.material.dispose()
                    }
                })
                scene.remove(this._chicken)
                this._chicken = null
            }
        }
    }
}

function loadChicken() {
    return new Promise(resolve => {
        const loader = new GLTFLoader()
        loader.load('../assets/chick.glb', model => {
            const chicken = model.scene
            const animations = model.animations
            const chickens = [
                SkeletonUtils.clone(chicken),
                SkeletonUtils.clone(chicken),
                SkeletonUtils.clone(chicken)
            ]

            resolve([chickens, animations])
        })
    })
}

function createWall() {
    const rand = () => Math.floor(Math.random() * 30) + 5
    const rando = () => Math.random() < 0.5 ? rand() : -rand()

    const arr = []
    for (let i = 1; i < 100; i++) {
        const w = new THREE.BoxGeometry(2, 2, 2)
        w.translate(rando(), 1, rando())
        arr.push(w)
    }
    const material = new THREE.MeshPhongMaterial({ color: 0xFF0000 })
    const merge = BufferGeometryUtils.mergeBufferGeometries(arr)
    const walls = new THREE.Mesh(merge, material)

    return walls
}

(async function main() {
    const clock = new THREE.Clock()
    const { renderer, scene, camera, stats } = setup()

    const player = new Player()
    await player.init(scene)
    const [c, a] = await loadChicken()
    const chickens = [
        new Chicken(c[0], a, 40, 20),
        new Chicken(c[1], a, -30, -20),
        new Chicken(c[2], a, -35, 35)
    ]
    chickens.forEach(c => c.init(scene))

    const followLight = new FollowLight(player.getPlayer())
    scene.add(followLight.getFollowLight())
    const followCamera = new FollowCamera(camera, player.getPlayer())

    const walls = createWall()
    walls.castShadow = true
    scene.add(walls)

    function animate() {
        const dt = clock.getDelta()
        const playerBox = player.getBox3()
        player.update(dt)
        player.collision(walls)
        followLight.update()
        followCamera.update(dt)

        chickens.forEach(c => {
            c.update(dt)
            c.collision(playerBox, scene)
        })

        renderer.render(scene, camera)
        requestAnimationFrame(animate)
    }
    animate()
})()




