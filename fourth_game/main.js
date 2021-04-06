import * as THREE from '../build/three.module.js'
import { BufferGeometryUtils } from '../build/BufferGeometryUtils.js'

class InputController {
    constructor() {
        this._forward = false
        this._backward = false
        this._right = false
        this._left = false
        this._jump = false

        document.addEventListener('keydown', (e) => this._onKeyDown(e))
        document.addEventListener('keyup', (e) => this._onKeyUp(e))
    }

    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW':
                this._forward = true
                break
            case 'KeyS':
                this._backward = true
                break
            case 'KeyD':
                this._right = true
                break
            case 'KeyA':
                this._left = true
                break
            case 'Space':
                this._jump = true
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW':
                this._forward = false
                break
            case 'KeyS':
                this._backward = false
                break
            case 'KeyD':
                this._right = false
                break
            case 'KeyA':
                this._left = false
                break
        }
    }
}

class Platform {
    constructor(args, level) {
        const material = new THREE.MeshPhongMaterial({ color: 0x596160 })
        const geometries = this._mergedGeometries(args)
        this._platform = new THREE.Mesh(geometries, material)
        this._platform.translateY(level)
    }

    _mergedGeometries(args) {
        const geometries = []

        for (let arg of args) {
            const t = new THREE.BoxGeometry(7, 1, 3)
            t.translate(arg[0], arg[1], arg[2])

            geometries.push(t)
        }

        const mergedGeometries = BufferGeometryUtils.mergeBufferGeometries(geometries, false)
        return mergedGeometries
    }

    getPlatform() {
        return this._platform
    }
}

class Player {
    static GRAVITY = -20
    static JUMP_POWER = 10

    constructor() {
        this._player = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshPhongMaterial({ color: 0xFF0000 })
        )
        this._player.position.set(0, 1, 56)
        this._velocity = 5
        this._angle = THREE.MathUtils.degToRad(60)
        this._jumpVelocity = Player.JUMP_POWER

        this._origin = this._player.position.clone()
        this._direction = new THREE.Vector3(0, -1, 0)
        this._raycast = new THREE.Raycaster(this._origin, this._direction, 0, 2)
        this._input = new InputController()
    }

    getPlayer() {
        return this._player
    }

    getYPosition() {
        return this._player.position.y
    }

    update(dt, platforms) {
        this._origin = this._player.position.clone()
        this._raycast.set(this._origin, this._direction)

        const intersect = this._raycast.intersectObjects(platforms)

        if (!intersect.length && !this._input._jump) {
            this._player.translateY(Player.GRAVITY * dt)
        }
        if (this._input._forward) {
            this._player.translateZ(-this._velocity * dt)
        }
        if (this._input._backward) {
            this._player.translateZ(this._velocity * dt)
        }
        if (this._input._right) {
            this._player.rotateY(-this._angle * dt)
        }
        if (this._input._left) {
            this._player.rotateY(this._angle * dt)
        }

        if (this._input._jump) {
            this._jumpVelocity += Player.GRAVITY * dt
            this._player.translateY(this._jumpVelocity * dt)

            for (let i of intersect) {
                if (i.distance < 0.5) {
                    this._jumpVelocity = Player.JUMP_POWER
                    this._input._jump = false

                    const resetYPosition = i.object.position.y + 1
                    this._player.position.y = resetYPosition
                }
            }
        }
    }
}

class FollowCamera {
    constructor(camera, target) {
        this._camera = camera
        this._target = target

        this._offset = new THREE.Vector3()
        this._lookAt = new THREE.Vector3()
    }

    _calculateIdealOffset() {
        const offset = new THREE.Vector3(0, 15, 25)
        offset.applyEuler(this._target.rotation.clone())
        offset.add(this._target.position.clone())

        return offset
    }

    _calculateIdealLookAt() {
        const lookAt = new THREE.Vector3(0, -5, -10)
        lookAt.applyEuler(this._target.rotation.clone())
        lookAt.add(this._target.position.clone())

        return lookAt
    }

    update(dt) {
        const idealOffset = this._calculateIdealOffset()
        const idealLookAt = this._calculateIdealLookAt()

        const t = 1.0 - Math.pow(0.001, dt)
        this._offset.lerp(idealOffset, t)
        this._lookAt.lerp(idealLookAt, t)

        this._camera.position.copy(this._offset)
        this._camera.lookAt(this._lookAt)
    }
}

class Game {
    constructor(canvas, el) {
        this._canvas = canvas
        this._el = el

        this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        this._renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight)

        this._clock = new THREE.Clock()
        this._scene = new THREE.Scene()
        this._camera = new THREE.PerspectiveCamera(45, this._canvas.clientWidth / this._canvas.clientHeight, 1, 1000)
        this._scene.background = new THREE.Color(0xCFF4FF)

        this._player = new Player()
        this._followCamera = new FollowCamera(this._camera, this._player.getPlayer())
        this._platform = []
    }

    _load() {
        const ambientLight = new THREE.AmbientLight(0xCFF4FF, 0.2)
        const directionalLight = new THREE.DirectionalLight(0xF1F1F1, 1)
        directionalLight.position.set(0, 40, 10)

        const points_one = [
            [0, 0, 56],
            [0, 0, 50],
            [0, 0, 44],
            [0, 0, 8],
            [0, 0, 2],
            [0, 0, -4],
            [0, 0, -40],
            [0, 0, -46],
            [0, 0, -52]
        ]
        const points_two = [
            [0, 0, 38],
            [0, 0, 14],
            [0, 0, -10],
            [0, 0, -34]
        ]
        const points_three = [
            [0, 0, 32],
            [0, 0, 20],
            [0, 0, -16],
            [0, 0, -28]
        ]
        const points_four = [
            [0, 0, 26],
            [0, 0, -22]
        ]

        const levelOne = new Platform(points_one, 0)
        const levelTwo = new Platform(points_two, 1)
        const levelThree = new Platform(points_three, 2)
        const levelFour = new Platform(points_four, 3)
        this._platform = [
            levelOne.getPlatform(),
            levelTwo.getPlatform(),
            levelThree.getPlatform(),
            levelFour.getPlatform()
        ]

        this._scene.add(ambientLight)
        this._scene.add(directionalLight)
        this._scene.add(this._player.getPlayer())
        for (let pl of this._platform) {
            this._scene.add(pl)
        }
    }

    _animate() {
        const dt = this._clock.getDelta()

        if (this._player.getYPosition() < -5) {
            this._end()
            return
        }

        this._player.update(dt, this._platform)
        this._followCamera.update(dt)
        this._renderer.render(this._scene, this._camera)
        requestAnimationFrame(this._animate.bind(this))
    }

    _end() {
        this._el.style.display = 'block'
        this._canvas.style.display = 'none'
    }

    start() {
        this._load()
        this._animate()
    }
}

(function start() {
    const gameScreen = document.querySelector('#game-screen')
    const canvas = document.querySelector('#canvas')

    gameScreen.addEventListener('click', function () {
        gameScreen.style.display = 'none'
        canvas.style.display = 'block'

        const game = new Game(canvas, gameScreen)
        game.start()
    })
})()







