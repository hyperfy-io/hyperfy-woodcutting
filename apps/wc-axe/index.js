import React, { useRef, useEffect } from 'react'
import { useWorld, useSyncState, useEntityUid } from 'hyperfy'
import { Vector3, Quaternion, Euler } from 'hyperfy'

const v1 = new Vector3()
const e1 = new Euler()
const q1 = new Quaternion()

// utilities to convert blender coordinates to web (position and quaternion).
const bv3 = (x, y, z) => [x, z, -y]
const bq = (w, x, y, z) => {
  q1.set(x, z, -y, w)
  e1.setFromQuaternion(q1)
  return e1.toArray()
}

const idlePosition = bv3(-0.043863, -0.511247, 0.818243)
const idleRotation = bq(0.856593, 0.041646, 0.514276, 0.005902)

const TAKE_DISTANCE = 5
const CHOP_DISTANCE = 1.5

export default function App() {
  const world = useWorld()
  return (
    <app>
      {world.isClient && <Client />}
      {world.isServer && <Server />}
    </app>
  )
}

function Client() {
  const entityId = useEntityUid()
  const axeRef = useRef()
  const swingSoundRef = useRef()

  const world = useWorld()
  const [state, dispatch] = useSyncState(s => s)

  const heldBy = state.heldBy
  const heldAt = state.heldAt
  const usedAt = state.usedAt

  const heldByMe = heldBy === world.getAvatar()?.uid

  const take = () => {
    const avatarId = world.getAvatar().uid
    const time = world.getTime()
    world.emit('held', { entityId })
    dispatch('hold', avatarId, time)
  }

  const release = () => {
    dispatch('release')
  }

  useEffect(() => {
    // If the axe is being held, attach it to the players hand
    if (!heldBy) return
    if (heldByMe) world.emit('wc_axe:pickup')
    const axe = axeRef.current
    const stop = world.onUpdate(delta => {
      const avatar = world.getAvatar(heldBy)
      if (!avatar) return
      avatar.getBonePosition('rightHand', v1)
      axe.setPosition(v1)
      avatar.getBoneRotation('rightHand', e1)
      axe.setRotation(e1)
    })
    // Respond to axe checks from trees
    const l1 = world.on('wc_tree:check', () => {
      if (heldByMe) {
        world.emit('wc_axe:pickup')
      }
    })
    return () => {
      if (heldByMe) world.emit('wc_axe:drop')
      stop()
      l1()
    }
  }, [heldBy])

  useEffect(() => {
    // If the axe is being held by local player, handle swing and chop
    if (!heldBy) return
    const avatar = world.getAvatar()
    const isLocalPlayer = avatar?.uid === heldBy
    if (!isLocalPlayer) return
    let nextAllowedUse = -9999
    const onPointerDown = e => {
      const time = world.getTime()
      if (nextAllowedUse > time) return
      const hitStump = e.hit?.meshName === 'Stump_tcollider' && e.hit.distance < TAKE_DISTANCE // prettier-ignore
      const hitAxe = e.hit?.meshName === 'Axe' && e.hit.distance < TAKE_DISTANCE // prettier-ignore
      if (hitStump || hitAxe) return
      const hitTree = e.hit?.meshName === 'Trunk_tcollider' && e.hit.distance < CHOP_DISTANCE // prettier-ignore
      if (hitTree) {
        world.emit('wc_axe:chop', { entityId: e.hit.entityUid })
      }
      dispatch('use', time)
      nextAllowedUse = time + 0.5
    }
    const onSomethingHeld = msg => {
      // To prevent multiple items being held in one hand, all items should emit
      // a `held` event so that if you pick up an item while already holding another item
      // the first item gets dropped.
      if (msg.entityId !== entityId) {
        dispatch('release')
      }
    }
    world.on('pointer-down', onPointerDown)
    world.on('held', onSomethingHeld)
    return () => {
      world.off('pointer-down', onPointerDown)
      world.off('held', onSomethingHeld)
    }
  }, [heldBy])

  useEffect(() => {
    // Play axe swing sound whenever it is used
    const time = world.getTime()
    const timeAgo = time - usedAt
    if (timeAgo > 1.5) return
    const avatar = world.getAvatar()
    const isLocalPlayer = heldBy === avatar.uid
    if (isLocalPlayer) {
      world.emote('swing')
    }
    swingSoundRef.current.play(true)
  }, [usedAt])

  return (
    <>
      <rigidbody>
        {!heldBy && (
          <model
            src="axe.glb"
            position={idlePosition}
            rotation={idleRotation}
            onPointerDownHint="Take"
            onPointerDown={take}
            hitDistance={TAKE_DISTANCE}
          />
        )}
        <model
          src="stump.glb"
          onPointerDown={heldBy ? (heldByMe ? release : undefined) : take}
          onPointerDownHint={heldBy ? (heldByMe ? 'Place' : undefined) : 'Take'}
          hitDistance={TAKE_DISTANCE}
        />
      </rigidbody>
      <emote id="swing" src="swing.fbx" upperBody />
      <global>
        <group ref={axeRef}>
          {heldBy && (
            <model
              src="axe.glb"
              layer="COSMETIC"
              castShadow={false}
              receiveShadow={false}
            />
          )}
          <audio ref={swingSoundRef} src="swing.mp3" />
        </group>
      </global>
    </>
  )
}

function Server() {
  const [heldBy, dispatch] = useSyncState(state => state.heldBy)

  useEffect(() => {
    // Ensure that any player that leaves the world while holding axe is returned.
    const onLeave = avatar => {
      if (heldBy === avatar?.uid) {
        dispatch('release')
      }
    }
    world.on('leave', onLeave)
    return () => {
      world.off('leave', onLeave)
    }
  }, [heldBy])

  return null
}

const initialState = {
  heldBy: null, // the avatar holding the axe
  heldAt: -99999, // the time axe was held
  usedAt: -99999, // the last time the axe was used
}

export function getStore(state = initialState) {
  return {
    state,
    actions: {
      hold(state, avatarId, time) {
        state.heldBy = avatarId
        state.heldAt = time
        state.usedAt = -99999
      },
      use(state, usedAt) {
        state.usedAt = usedAt
      },
      release(state) {
        state.heldBy = null
        state.heldAt = -99999
        state.usedAt = -99999
      },
    },
    fields: [],
  }
}
