import * as THREE from './three.module.js'

function checkCollision(boxes, playerBox) {
    for (let box of boxes) {
        if (box.getBox3().intersectsBox(playerBox)) {
            return true
        }
    }

    return false
}

class Intersect {
    constructor() {
        this._box3 = new THREE.Box3()
    }

    getBox3() {
        return this._box3
    }
}

class Box extends Intersect {
    static bg = new THREE.BoxGeometry(2, .5, 2)
    static mat = new THREE.MeshPhongMaterial({ color: '#303030' })
    static xCoords = [-4, -1, 1, 4]

    constructor(posZ) {
        super()
        const posX = Box.xCoords[Math.floor(Math.random() * Box.xCoords.length)]

        this._box = new THREE.Mesh(Box.bg, Box.mat)
        this._box.position.set(posX, -0.25, posZ)
        this._box.geometry.computeBoundingBox()
    }

    getBox() {
        return this._box
    }

    setPosition(posZ) {
        this._box.position.z += posZ
        this._box3.setFromObject(this._box)
    }
}

class Player extends Intersect {
    constructor() {
        super()
        this._inputManager = new InputManager()
        this._speed = 5
        this._xLimit = 4

        this._player = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshPhongMaterial({ color: '#FF0000' })
        )
        this._player.geometry.computeBoundingBox()
        this._player.castShadow = true
        this._box3.setFromObject(this._player)
    }

    getPlayer() {
        return this._player
    }

    update(dt) {
        const { key_D_Pressed, key_A_Pressed } = this._inputManager.getKeyStatus()

        if (key_D_Pressed) {
            if (this._player.position.x < this._xLimit) {
                this._player.translateX(this._speed * dt)
                this._box3.setFromObject(this._player)
            }
        }

        if (key_A_Pressed) {
            if (this._player.position.x > -this._xLimit) {
                this._player.translateX(-this._speed * dt)
                this._box3.setFromObject(this._player)
            }
        }
    }
}

class Conveyor {
    static maxBox = 10

    constructor(score) {
        this._boxes = []
        this._hasNewBox = false
        this._boxGap = -20
        this._boxSpeed = 30
        this._coef = 15
        this._score = score
    }

    _create() {
        let boxPosition = -50

        if (this._boxes.length !== 0) {
            const idx = this._boxes.length - 1
            boxPosition = this._boxes[idx].getBox().position.z + this._boxGap
        }

        const box = new Box(boxPosition)
        this._boxes.push(box)
        this._hasNewBox = true
    }

    _remove() {
        let firstBox = this._boxes.shift()
        firstBox.getBox().geometry.dispose()
        firstBox.getBox().material.dispose()
        firstBox = undefined
    }

    getHasNewBox() {
        return this._hasNewBox
    }

    setHasNewBox(val) {
        this._hasNewBox = val
    }

    getBoxes() {
        return this._boxes
    }

    update(dt) {
        if (this._boxes.length < Conveyor.maxBox) {
            this._create()
        }
        else if (this._boxes[0].getBox().position.z > 30) {
            this._remove()
        }

        this._boxes.forEach(box => {
            box.setPosition(this._boxSpeed * dt)
        })

        if (this._score.getScore() > this._coef) {
            this._boxSpeed += 5
            this._coef += 15
        }
    }
}

class Scene {
    constructor() {
        const color = '#C4EEF8'
        this._scene = new THREE.Scene()
        this._scene.background = new THREE.Color(color)
        this._scene.fog = new THREE.Fog(color, 50, 150)
    }

    add(obj) {
        this._scene.add(obj)
    }

    update(conveyor) {
        if (conveyor.getHasNewBox()) {
            const boxes = conveyor.getBoxes()
            this._scene.add(boxes[boxes.length - 1].getBox())
            conveyor.setHasNewBox(false)
        }
    }

    getScene() {
        return this._scene
    }
}

class Score {
    constructor() {
        this._score = 0
        this._cumulative = 0
        this._el = document.getElementById('score')
        this._el.innerText = '000'
    }

    updateScore(dt) {
        this._cumulative += dt

        if (this._cumulative > 1) {
            this._score++
            this._cumulative = 0

            let score = this._score < 10 ? '00' + this._score : this._score < 100 ? '0' + this._score : this._score

            this._el.innerText = score
        }
    }

    getScore() {
        return this._score
    }
}

class InputManager {
    constructor() {
        this.key_D_Pressed = false
        this.key_A_Pressed = false

        document.body.addEventListener('keydown', (e) => {
            if (e.key === 'd') {
                this.key_D_Pressed = true
            } else if (e.key === 'a') {
                this.key_A_Pressed = true
            }
        })

        document.body.addEventListener('keyup', (e) => {
            if (e.key === 'd') {
                this.key_D_Pressed = false
            } else if (e.key === 'a') {
                this.key_A_Pressed = false
            }
        })
    }

    getKeyStatus() {
        return {
            key_D_Pressed: this.key_D_Pressed,
            key_A_Pressed: this.key_A_Pressed
        }
    }
}

class GameManager {
    constructor() {
        this._canvas = document.getElementById('canvas')
        this._renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true
        })
        this._renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight)
        this._renderer.shadowMap.enabled = true

        this._score = new Score()
        this._player = new Player()
        this._conveyor = new Conveyor(this._score)
        this._scene = new Scene()
        this._clock = new THREE.Clock()
        this._clock.autoStart = false
        this._camera = new THREE.PerspectiveCamera(45, this._canvas.clientWidth / this._canvas.clientHeight, 1, 200)
        this._camera.position.set(0, 2.5, 15)

        this._menu = document.getElementById('menu')
    }

    _load() {
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 300),
            new THREE.MeshPhongMaterial({ color: '#F4F4F4' })
        )
        plane.rotation.x = -Math.PI / 2
        plane.position.set(0, -0.5, -140)
        plane.receiveShadow = true

        const ambLight = new THREE.AmbientLight('#EEEEEE', 0.4)
        const dirLight = new THREE.DirectionalLight('#FFFFFF', 1)
        dirLight.position.set(2, 10, -2)
        dirLight.castShadow = true
        dirLight.shadow.camera.bottom = -6
        dirLight.shadow.mapSize.width = 1024
        dirLight.shadow.mapSize.height = 1024

        this._scene.add(plane)
        this._scene.add(ambLight)
        this._scene.add(dirLight)
        this._scene.add(this._player.getPlayer())
    }

    _animate() {
        const dt = this._clock.getDelta()

        this._conveyor.update(dt)
        this._player.update(dt)
        this._score.updateScore(dt)

        this._scene.update(this._conveyor)
        this._renderer.render(this._scene.getScene(), this._camera)

        if (checkCollision(this._conveyor.getBoxes(), this._player.getBox3())) {
            this.stopGame()
            return
        }

        requestAnimationFrame(this._animate.bind(this))
    }

    gameScreen() {
        this._load()
        this._renderer.render(this._scene.getScene(), this._camera)
    }

    startGame() {
        this._clock.start()
        this._load()
        this._animate()
        this._menu.style.visibility = 'hidden'
    }

    stopGame() {
        this._clock.stop()
        this._menu.children[0].children[0].innerText = 'Game Over'
        this._menu.style.visibility = 'visible'
    }
}

(function main() {
    let gm = new GameManager()
    gm.gameScreen()

    document.getElementById('start').addEventListener('click', () => {
        gm = new GameManager()
        gm.startGame()
    })
}())




