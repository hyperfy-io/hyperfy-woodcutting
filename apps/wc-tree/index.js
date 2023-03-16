import React, { useState, useRef, useEffect } from 'react'
import {
  useSignal,
  useWorld,
  useFields,
  useSyncState,
  useEntityUid,
} from 'hyperfy'

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
  const world = useWorld()
  const entityId = useEntityUid()

  const chopSoundRef = useRef()
  const fallSoundRef = useRef()

  const [hasAxe, setHasAxe] = useState(false)
  const [state, dispatch] = useSyncState(s => s)

  const health = state.health
  const healthAt = state.healthAt

  const checkAxe = () => {
    // let player know if they are trying to chop the tree without an axe
    if (!hasAxe) {
      world.chat('You need an axe.', true)
    }
  }

  useEffect(() => {
    // listen to axes being picked up by the local player
    const l1 = world.on('wc_axe:pickup', () => {
      setHasAxe(true)
    })
    // listen to axes being dropped by the local player
    const l2 = world.on('wc_axe:drop', () => {
      setHasAxe(false)
    })
    // if this tree spawned into the world late we need to query
    // axes to find out if the local player is holding one.
    const time = world.getTime()
    if (time > 3) world.emit('wc_tree:check')
    // cleanup on unmount
    return () => {
      l1()
      l2()
    }
  }, [])

  useEffect(() => {
    // play chop/fall sounds for all players.
    // this is ignored if it happened a long time ago (eg new players joining)
    const time = world.getTime()
    const timeAgo = time - healthAt
    if (timeAgo > 1.5) return
    chopSoundRef.current.play(true)
    if (!health) {
      fallSoundRef.current.play(true)
    }
  }, [health, healthAt])

  useEffect(() => {
    // listen for a player chopping this tree.
    if (!health) return
    return world.on('wc_axe:chop', msg => {
      if (msg.entityId === entityId) {
        const time = world.getTime()
        dispatch('hit', time)
      }
    })
  }, [health])

  // allow world editors to respawn trees on-demand/manually
  useSignal('Respawn', () => {
    dispatch('respawn')
  })

  return (
    <>
      <rigidbody>
        {health > 0 && (
          <model
            src="tree.glb"
            onPointerDown={checkAxe}
            onPointerDownHint="Chop"
            hitDistance={1.5} // matches wc-axe CHOP_DISTANCE variable
          />
        )}
        {health === 0 && <model src="stump.glb" />}
      </rigidbody>
      <audio ref={chopSoundRef} src="chop.mp3" />
      <audio ref={fallSoundRef} src="fall.mp3" />
    </>
  )
}

function Server() {
  const [health, dispatch] = useSyncState(state => state.health)
  const fields = useFields()
  const timer = fields.timer

  useEffect(() => {
    if (health) return
    // when the tree falls, start a respawn timer
    const ms = (timer || 30) * 1000
    setTimeout(() => {
      dispatch('respawn')
    }, ms)
  }, [health, timer])

  return null
}

const initialState = {
  health: 3, // 0 = fallen
  healthAt: -9999,
}

export function getStore(state = initialState) {
  return {
    state,
    actions: {
      hit(state, time) {
        state.health--
        if (state.health < 0) state.health = 0
        state.healthAt = time
      },
      respawn(state) {
        state.health = 3
        state.healthAt = -9999
      },
    },
    fields: [
      {
        key: 'timer',
        label: 'Timer',
        type: 'float',
        placeholder: '30 Seconds',
      },
    ],
  }
}
