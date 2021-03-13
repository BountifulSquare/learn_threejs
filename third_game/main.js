import * as THREE from '../three.module.js'

class InputController {
    constructor() {
        this._forward = false
        this._backward = false
        this._right = false
        this._left = false
        this._shoot = false

        document.addEventListener('keydown', (e) => this._onKeyDown(e))
        document.addEventListener('keyup', (e) => this._onKeyUp(e))
        document.addEventListener('click', () => this._onClick())
    }

    _onKeyDown(e) {
        switch (e.code) {
            case "KeyW":
                this._forward = true
                break
            case "KeyS":
                this._backward = true
                break
            case "KeyD":
                this._right = true
                break
            case "KeyA":
                this._left = true
                break
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case "KeyW":
                this._forward = false
                break
            case "KeyS":
                this._backward = false
                break
            case "KeyD":
                this._right = false
                break
            case "KeyA":
                this._left = false
                break
        }
    }

    _onClick() {
        this._shoot = true
    }
}

class Intersect {
    constructor() {
        this._box3 = new THREE.Box3()
    }

    getBox3() {
        return this._box3
    }

    checkCollision(playerBox) {
        if (this._box3.intersectsBox(playerBox)) {
            return true
        }

        return false
    }
}

class Block extends Intersect {
    static boxGeo = new THREE.BoxGeometry()
    static blueMat = new THREE.MeshPhongMaterial({ color: 0x007988 })

    constructor(posX, posZ, scaleX, scaleZ) {
        super()
        this._block = new THREE.Mesh(Block.boxGeo, Block.blueMat)
        this._block.position.set(posX, 1, posZ)
        this._block.scale.set(scaleX, 1, scaleZ)
        this._block.castShadow = true
        this._block.geometry.computeBoundingBox()
        this._box3.setFromObject(this._block)
    }

    getBlock() {
        return this._block
    }
}

class Bullet extends Intersect {
    constructor(matrix4) {
        super()
        const sphereGeo = new THREE.SphereGeometry(0.35)
        const redMat = new THREE.MeshPhongMaterial({ color: 0xFF0000 })

        this._bullet = new THREE.Mesh(sphereGeo, redMat)
        this._bullet.applyMatrix4(matrix4)
        this._bullet.translateZ(-1)
        this._bullet.castShadow = true
        this._bullet.geometry.computeBoundingBox()

        this._speed = 20
        this._newBullet = true
        this._shouldRemove = false
        this._hp = 3
    }

    getBullet() {
        return this._bullet
    }

    update(dt) {
        this._bullet.translateZ(-this._speed * dt)
        this._box3.setFromObject(this._bullet)
    }

    checkCollision(enemies, walls) {
        for (let enemy of enemies) {
            if (this._box3.intersectsBox(enemy.getBox3())) {
                this._hp--
                enemy.decreaseHP()
            }
        }

        for (let wall of walls) {
            if (this._box3.intersectsBox(wall.getBox3())) {
                this._hp = 0
            }
        }

        if (this._hp <= 0) {
            this._shouldRemove = true
        }
    }

    getIsNewBullet() {
        return this._newBullet
    }

    setIsNewBullet() {
        this._newBullet = false
    }

    getShouldRemove() {
        return this._shouldRemove
    }

    remove() {
        this._bullet.geometry.dispose()
        this._bullet.material.dispose()
        this._box3.makeEmpty()
    }
}

class Magazine {
    constructor() {
        this._magazine = []
    }

    getMagazine() {
        return this._magazine
    }

    setMagazine(magazine) {
        this._magazine = magazine
    }

    store(bullet) {
        this._magazine.push(bullet)
    }
}

class Enemy extends Intersect {
    constructor(posX, posZ) {
        super()
        const cyGeo = new THREE.CylinderGeometry(1, 1, 2)
        const blueMat = new THREE.MeshPhongMaterial({ color: 0x0000FF })

        this._enemy = new THREE.Mesh(cyGeo, blueMat)
        this._enemy.position.set(posX, 0, posZ)
        this._enemy.castShadow = true
        this._enemy.geometry.computeBoundingBox()
        this._speed = 2
        this._hp = 9
    }

    getEnemy() {
        return this._enemy
    }

    decreaseHP() {
        this._hp--
    }

    getHP() {
        return this._hp
    }

    remove() {
        this._enemy.geometry.dispose()
        this._enemy.material.dispose()
        this._box3.makeEmpty()
    }

    update(dt, target) {
        this._enemy.lookAt(target)
        this._enemy.translateZ(this._speed * dt)
        this._box3.setFromObject(this._enemy)
    }
}

class Player extends Intersect {
    constructor(magazine) {
        super()
        const cyGeo = new THREE.CylinderGeometry(1, 1, 2)
        const boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7)
        const redMat = new THREE.MeshPhongMaterial({ color: 0xFF0000 })

        this._nozel = new THREE.Mesh(boxGeo, redMat)
        this._nozel.translateZ(-1)
        this._nozel.translateY(1)
        this._body = new THREE.Mesh(cyGeo, redMat)
        this._nozel.castShadow = true
        this._body.castShadow = true

        this._player = new THREE.Object3D()
        this._player.add(this._nozel)
        this._player.add(this._body)
        this._body.geometry.computeBoundingBox()
        this._box3.setFromObject(this._body)

        this._input = new InputController()
        this._speed = 10
        this._angle = THREE.MathUtils.degToRad(80)
        this._hp = 5

        this._magazine = magazine
    }

    getPlayer() {
        return this._player
    }

    getPosition() {
        return this._player.position
    }

    update(dt) {
        if (this._input._forward) {
            this._player.translateZ(-this._speed * dt)
        }
        if (this._input._backward) {
            this._player.translateZ(this._speed * dt)
        }
        if (this._input._right) {
            this._player.rotateY(-this._angle * dt)
        }
        if (this._input._left) {
            this._player.rotateY(this._angle * dt)
        }

        if (this._input._shoot) {
            const matrix4 = this._nozel.matrixWorld.clone()
            const bullet = new Bullet(matrix4)

            this._magazine.store(bullet)
            this._input._shoot = false
        }

        this._box3.setFromObject(this._body)
    }

    getHP() {
        return this._hp
    }

    setHP() {
        this._hp--
    }
}

class Game {
    constructor(canvas, el) {
        this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        this._el = el
        this._renderer.setSize(canvas.clientWidth, canvas.clientHeight)
        this._renderer.shadowMap.enabled = true

        this._camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 1, 100)
        this._scene = new THREE.Scene()
        this._clock = new THREE.Clock()
        this._magazine = new Magazine()
        this._player = new Player(this._magazine)
        this._enemies = [
            new Enemy(10, -15),
            new Enemy(30, -4),
            new Enemy(4, 16),
            new Enemy(-28, 10),
            new Enemy(-20, -10),
        ]
        this._blocks = [
            // outer wall to catch out of bound bullet
            new Block(0, -25, 90, 1),
            new Block(0, 25, 90, 1),
            new Block(-45, 0, 1, 50),
            new Block(45, 0, 1, 50),

            new Block(20, 10, 4, 2),
            new Block(30, 0, 2, 4),
            new Block(15, -12, 2, 4),
            new Block(0, -3, 4, 2),
            new Block(-20, 8, 2, 4),
            new Block(-15, -12, 4, 2),
            new Block(-30, -2, 4, 2),
        ]
    }

    _load() {
        this._camera.position.set(0, 50, 0)
        this._camera.lookAt(0, 0, 0)

        const ambLight = new THREE.AmbientLight(0xF9F9F9, 0.5)
        const dirLight = new THREE.DirectionalLight(0xF5F5F5, 1)
        dirLight.position.set(20, 30, 0)
        dirLight.target.position.set(0, 0, 0)
        dirLight.castShadow = true
        dirLight.shadow.camera.left = -30
        dirLight.shadow.camera.right = 30
        dirLight.shadow.camera.bottom = -40
        dirLight.shadow.camera.top = 40
        dirLight.shadow.mapSize.width = 2048
        dirLight.shadow.mapSize.height = 2048

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 50),
            new THREE.MeshPhongMaterial({ color: 0xF9F9F9 })
        )
        plane.rotation.x = -Math.PI / 2
        plane.receiveShadow = true

        this._scene.background = new THREE.Color(0xF9F9F9)
        this._scene.add(plane)
        this._scene.add(this._player.getPlayer())
        this._scene.add(ambLight)
        this._scene.add(dirLight)
        for (let enemy of this._enemies) {
            this._scene.add(enemy.getEnemy())
        }
        for (let block of this._blocks) {
            this._scene.add(block.getBlock())
        }
    }

    _animate() {
        const dt = this._clock.getDelta()
        const magazine = this._magazine.getMagazine()
        const _magazine = []
        const _enemies = []
        const playerPosition = this._player.getPosition()
        const playerBox = this._player.getBox3()

        if (!this._enemies.length) {
            this._el.innerText = 'Completed'
            this._el.style.visibility = 'visible'
            return
        }

        for (let bullet of magazine) {
            bullet.update(dt)
            bullet.checkCollision(this._enemies, this._blocks)

            if (bullet.getIsNewBullet()) {
                this._scene.add(bullet.getBullet())
            }

            if (bullet.getShouldRemove()) {
                bullet.remove()
                this._scene.remove(bullet.getBullet())
            } else {
                _magazine.push(bullet)
            }
        }

        for (let enemy of this._enemies) {
            enemy.update(dt, playerPosition)

            if (enemy.checkCollision(playerBox)) {
                this._player.setHP()
            }

            if (enemy.getHP() < 0) {
                enemy.remove()
                this._scene.remove(enemy.getEnemy())
            } else {
                _enemies.push(enemy)
            }
        }

        if (this._player.getHP() < 1) {
            this._el.innerText = 'Game Over!'
            this._el.style.visibility = 'visible'
            return
        }

        this._magazine.setMagazine(_magazine)
        this._enemies = _enemies
        this._player.update(dt)
        this._renderer.render(this._scene, this._camera)

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

