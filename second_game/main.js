import * as THREE from '../three.module.js'

class Camera {
    constructor(width, height) {
        this._camera = new THREE.PerspectiveCamera(45, width / height, 1, 200)
        this._camera.position.set(0, 30, 20)
        this._camera.lookAt(0, 0, 0)
    }

    getCamera() {
        return this._camera
    }
}

class Scene {
    constructor() {
        this._scene = new THREE.Scene()
        this._scene.background = new THREE.Color(0xF0F0F0)
    }

    getScene() {
        return this._scene
    }

    add(child) {
        this._scene.add(child)
    }

    remove(obj) {
        const box3 = obj.getBox3()
        const diamond = obj.getDiamond()
        box3.makeEmpty()
        diamond.geometry.dispose()
        diamond.material.dispose()
        this._scene.remove(diamond)
    }
}

class InputController {
    constructor() {
        this._forward = false
        this._backward = false
        this._right = false
        this._left = false
        this._jump = false

        document.body.addEventListener('keydown', (e) => this._onKeyDown(e))
        document.body.addEventListener('keyup', (e) => this._onKeyUp(e))
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
                break
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

class Intersect {
    constructor() {
        this._box3 = new THREE.Box3()
    }

    getBox3() {
        return this._box3
    }
}

class Player extends Intersect {
    static GRAVITY = -50
    static MAX_SPEED = 5
    static JUMP_FORCE = 10

    constructor() {
        super()
        this._player = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshPhongMaterial({ color: 0xFF0000 })
        )
        this._player.position.set(0, 0, -5)
        this._player.geometry.computeBoundingBox()

        this._horizontalSpeed = Player.MAX_SPEED
        this._verticalSpeed = Player.JUMP_FORCE
        this._inputController = new InputController()

    }

    getPlayer() {
        return this._player
    }

    _jump(dt) {
        if (this._inputController._jump) {
            this._verticalSpeed += Player.GRAVITY * dt
            this._player.position.y += this._verticalSpeed * dt

            if (this._player.position.y < 0) {
                this._verticalSpeed = Player.JUMP_FORCE
                this._player.position.y = 0
                this._inputController._jump = false
            }
        }
    }

    _move(dt) {
        const speed = this._horizontalSpeed * dt

        if (this._inputController._forward) {
            this._player.position.z -= speed
        }
        else if (this._inputController._backward) {
            this._player.position.z += speed
        }
        else if (this._inputController._right) {
            this._player.position.x += speed
        }
        else if (this._inputController._left) {
            this._player.position.x -= speed
        }
    }

    update(dt) {
        this._move(dt)
        this._jump(dt)
        this._box3.setFromObject(this._player)
    }
}

class Wall extends Intersect {
    static bg = new THREE.BoxGeometry(1, 1, 1)
    static mat = new THREE.MeshPhongMaterial({ color: 0x3A5A62 })

    constructor(posX, posZ, scaleX, scaleZ) {
        super()
        this._wall = new THREE.Mesh(Wall.bg, Wall.mat)
        this._wall.position.set(posX, 0, posZ)
        this._wall.scale.set(scaleX, 1, scaleZ)
        this._wall.geometry.computeBoundingBox()

        this._box3.setFromObject(this._wall)
    }

    getWall() {
        return this._wall
    }
}

class Diamond extends Intersect {
    static dg = new THREE.OctahedronGeometry(0.5)
    static mat = new THREE.MeshPhongMaterial({ color: 0xA2E607 })

    constructor(posX, posZ) {
        super()
        this._diamond = new THREE.Mesh(Diamond.dg, Diamond.mat)
        this._diamond.position.set(posX, 1.2, posZ)
        this._diamond.geometry.computeBoundingBox()
        this._box3.setFromObject(this._diamond)
        this._rotSpeed = 0.5
    }

    getDiamond() {
        return this._diamond
    }

    update(dt) {
        this._diamond.rotation.y += this._rotSpeed * dt
    }

    checkCollision(playerBox) {
        if (this._box3.intersectsBox(playerBox)) {
            return true
        }

        return false
    }
}

class Monster extends Intersect {
    static cg = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 6)
    static mat = new THREE.MeshPhongMaterial({ color: 0xFFA33C })

    constructor(posX, posZ, rotAxis1, rotAxis2, minPos, maxPos) {
        super()
        this._monster = new THREE.Mesh(Monster.cg, Monster.mat)
        this._monster.position.set(posX, 0, posZ)
        this._monster.rotation[rotAxis1] = THREE.MathUtils.degToRad(90)
        this._monster.geometry.computeBoundingBox()

        this._rotAxis2 = rotAxis2
        this._moveAxis = rotAxis1
        this._minPos = minPos
        this._maxPos = maxPos
        this._speed = 3
        this._rotSpeed = 2.5
    }

    getMonster() {
        return this._monster
    }

    update(dt) {
        this._monster.rotation[this._rotAxis2] += this._rotSpeed * dt
        this._monster.position[this._moveAxis] += this._speed * dt
        this._box3.setFromObject(this._monster)

        if (
            this._monster.position[this._moveAxis] < this._minPos ||
            this._monster.position[this._moveAxis] > this._maxPos
        ) {
            this._speed = -this._speed
        }
    }

    checkCollision(playerBox) {
        if (this._box3.intersectsBox(playerBox)) {
            return true
        }

        return false
    }
}

class Game {
    constructor(canvas, el) {
        this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        this._el = el
        this._renderer.setSize(canvas.clientWidth, canvas.clientHeight)

        this._player = new Player()
        this._walls = this._generateWall()
        this._diamonds = this._spawnDiamond()
        this._monsters = this._spawnMonster()
        this._scene = new Scene()
        this._camera = new Camera(canvas.clientWidth, canvas.clientHeight)
        this._clock = new THREE.Clock()
        this._count = 14
    }

    _generateWall() {
        return [
            // top bottom
            new Wall(0, -20, 30, 1),
            new Wall(0, 10, 30, 1),
            // left side
            new Wall(-15, -5, 1, 30),
            new Wall(15, -5, 1, 30),
            // left rigtt barrier
            new Wall(-9, -5, 1, 10),
            new Wall(9, -5, 1, 10),
            // top bottom barrier
            new Wall(0, -14, 10, 1),
            new Wall(0, 4, 10, 1)
        ]
    }

    _spawnDiamond() {
        return [
            new Diamond(-11.5, 0),
            new Diamond(-11.5, -3),
            new Diamond(-11.5, -6),
            new Diamond(-11.5, -9),

            new Diamond(11.5, 0),
            new Diamond(11.5, -3),
            new Diamond(11.5, -6),
            new Diamond(11.5, -9),

            new Diamond(4, 7),
            new Diamond(0, 7),
            new Diamond(-4, 7),

            new Diamond(4, -16),
            new Diamond(0, -16),
            new Diamond(-4, -16),
        ]
    }

    _spawnMonster() {
        return [
            new Monster(-12, -8, 'z', 'x', -10, 0),
            new Monster(12, -1, 'z', 'x', -10, 0),
            new Monster(-3, 7, 'x', 'y', -5, 5),
            new Monster(4, -16, 'x', 'y', -5, 5)
        ]
    }

    _load() {
        const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1)
        dirLight.position.set(0, 20, -5)
        const ambLight = new THREE.AmbientLight(0xF1F1F1, 0.4)

        this._scene.add(this._player.getPlayer())
        this._scene.add(dirLight)
        this._scene.add(ambLight)
        this._walls.forEach(wall => this._scene.add(wall.getWall()))
        this._diamonds.forEach(diamond => this._scene.add(diamond.getDiamond()))
        this._monsters.forEach(monster => this._scene.add(monster.getMonster()))
    }

    _animate() {
        const dt = this._clock.getDelta()
        const playerBox = this._player.getBox3()
        this._player.update(dt)

        if (this._count === 0) {
            this._el.innerText = 'Completed'
            this._el.style.visibility = 'visible'
            return
        }

        for (let monster of this._monsters) {
            monster.update(dt)
            if (monster.checkCollision(playerBox)) {
                this._el.innerText = 'Game Over!'
                this._el.style.visibility = 'visible'
                return
            }
        }

        for (let diamond of this._diamonds) {
            diamond.update(dt)
            if (diamond.checkCollision(playerBox)) {
                this._scene.remove(diamond)
                this._count--
            }
        }

        this._renderer.render(this._scene.getScene(), this._camera.getCamera())
        requestAnimationFrame(this._animate.bind(this))
    }

    start() {
        this._load()
        this._animate()
        this._el.style.visibility = 'hidden'
    }
}

(function main() {
    const canvas = document.getElementById('canvas')
    const el = document.getElementById('action')

    el.addEventListener('click', function () {
        const game = new Game(canvas, el)
        game.start()
    })
}())