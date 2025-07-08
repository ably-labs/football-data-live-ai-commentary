"use client"

import { useState, useEffect } from "react"
import { useAbly } from "ably/react"
import * as Ably from 'ably'
import type { PresenceMessage } from "ably"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dribbble,
  Shield,
  Hand,
  RectangleVertical,
  Goal,
  RefreshCw,
  Play,
  Users,
  Loader2,
  Ghost,
} from "lucide-react"
import { type Player, initialPlayers } from "../game-data"
import { cn } from "@/lib/utils"
import { AICommentary } from './ai-commentary'
import { GAME_DURATION_SECONDS } from '../lib/constants'

// Use different channels for development vs production
const isDevelopment = import.meta.env.DEV;
const channelPrefix = isDevelopment ? 'development' : 'production';
const MAIN_CHANNEL = import.meta.env.VITE_MAIN_CHANNEL || `football-frenzy:${channelPrefix}:main`;


function PresenceIndicator({ count }: { count: number }) {
  const [currentUrl, setCurrentUrl] = useState("/")
  
  useEffect(() => {
    setCurrentUrl(window.location.href)
  }, [])
  
  if (count <= 1) {
    return (
      <p className="text-sm text-gray-400 text-center">
        It&apos;s just you here. Why not{" "}
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-cyan-400"
        >
          open another tab
        </a>{" "}
        to get a friend?
      </p>
    )
  }
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-green-400">
      <Users className="h-4 w-4" />
      <span>
        {count - 1} other fan{count - 1 > 1 ? "s" : ""} here now
      </span>
    </div>
  )
}

function GlobalPresenceIndicator({
  members = [],
  clientId,
}: {
  members?: PresenceMessage[]
  clientId?: string
}) {
  const MAX_AVATARS_SHOWN = 4
  const totalMembers = members.length
  const [currentUrl, setCurrentUrl] = useState("/")
  
  useEffect(() => {
    setCurrentUrl(window.location.href)
  }, [])

  const avatarColors = [
    "#be123c", // Rose 700
    "#0f766e", // Teal 600
    "#a16207", // Yellow 700
    "#4f46e5", // Indigo 600
    "#c2410c", // Orange 700
    "#581c87", // Purple 800
    "#15803d", // Green 700
    "#1d4ed8", // Blue 700
  ]

  const getColorForClientId = (id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash % avatarColors.length)
    return avatarColors[index]
  }

  const indicator =
    totalMembers <= 1 ? (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 p-2 rounded-full bg-gray-800/50 border border-gray-700 backdrop-blur-sm shadow-lg">
          <Ghost className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-400 pr-1">Just you</span>
        </div>
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-400 hover:underline"
        >
          +1 friend?
        </a>
      </div>
    ) : (
      <div className="flex items-center gap-3 p-1.5 pr-4 rounded-full bg-gray-800/50 border border-gray-700 backdrop-blur-sm shadow-lg">
        <div className="flex -space-x-3">
          {members.slice(0, MAX_AVATARS_SHOWN).map((member) => (
            <Avatar key={member.clientId} className="h-8 w-8 border-2 border-gray-900">
              <AvatarFallback
                className="text-white text-xs font-bold"
                style={{ backgroundColor: getColorForClientId(member.clientId) }}
              >
                {member.clientId.substring(5, 7).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {totalMembers > MAX_AVATARS_SHOWN && (
            <Avatar className="h-8 w-8 border-2 border-gray-900">
              <AvatarFallback className="bg-gray-600 text-white text-xs font-bold">
                +{totalMembers - MAX_AVATARS_SHOWN}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <span className="text-sm font-bold text-green-400">{totalMembers}</span>
      </div>
    )

  return (
    <div className="flex flex-col items-end gap-2">
      {indicator}
      {clientId && (
        <div className="text-[10px] text-gray-500 bg-black/20 px-1.5 py-0.5 rounded-full">Session ID: {clientId}</div>
      )}
    </div>
  )
}

function StartGameModal({ onStart, presenceCount }: { onStart: () => void; presenceCount: number }) {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-800 border-gray-600 text-white max-w-md text-center animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-2xl text-yellow-300">Welcome to Legends&apos; League!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>The stage is set for a 5-a-side clash of the titans!</p>
          <p>Control the legends, trigger iconic moments, and watch the hilarious commentary unfold in real-time.</p>
          <PresenceIndicator count={presenceCount} />
        </CardContent>
        <CardFooter className="flex justify-center p-4">
          <Button onClick={onStart} size="lg" className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-2 h-5 w-5" />
            Start the Match!
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function GameDashboard() {
  console.log('GameDashboard rendering')
  const client = useAbly()
  console.log('Client:', client)
  
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [score, setScore] = useState({ home: 0, away: 0 })
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS)
  const [isGameActive, setIsGameActive] = useState(false)
  const [gameHasStarted, setGameHasStarted] = useState(false)
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false)
  const [presenceData, setPresenceData] = useState<PresenceMessage[]>([])
  const [lastServerTimeUpdate, setLastServerTimeUpdate] = useState<number>(Date.now())

  // Try using channel without the hook
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null)
  
  useEffect(() => {
    if (!client) return
    
    console.log('Setting up channel:', MAIN_CHANNEL)
    console.log('Environment:', isDevelopment ? 'development' : 'production')
    const ch = client.channels.get(MAIN_CHANNEL)
    setChannel(ch)
    
    const messageHandler = (message: Ably.Message) => {
      processMessage(message)
    }
    
    ch.subscribe(messageHandler)
    
    return () => {
      ch.unsubscribe(messageHandler)
    }
  }, [client])

  // Manual presence implementation
  useEffect(() => {
    if (!channel || !isHistoryLoaded) return

    const onPresenceUpdate = async () => {
      const members = await channel.presence.get()
      setPresenceData(members)
    }

    channel.presence.subscribe(["enter", "leave", "update"], onPresenceUpdate)
    channel.presence.enter({ name: "A Fan" })
    onPresenceUpdate() // Get initial state

    return () => {
      channel.presence.leave()
      channel.presence.unsubscribe()
    }
  }, [channel, isHistoryLoaded])

  const presenceCount = presenceData.length

  const processMessage = (message: Ably.Message) => {
    switch (message.name) {
      case "player-stat-update":
        setPlayers((prev) =>
          prev.map((p) => (p.id === message.data.playerId ? { ...p, stats: message.data.newStats } : p)),
        )
        break
      case "score-update":
        setScore(message.data)
        break
      case "game-status-update":
        if (message.data.isGameActive) setGameHasStarted(true)
        setIsGameActive(message.data.isGameActive)
        setTimeLeft(message.data.timeLeft)
        break
      case "time-update":
        setTimeLeft(message.data.timeLeft)
        setLastServerTimeUpdate(Date.now())
        break
      case "reset":
        setPlayers(initialPlayers)
        setScore({ home: 0, away: 0 })
        setTimeLeft(GAME_DURATION_SECONDS)
        setIsGameActive(false)
        setGameHasStarted(false)
        break
    }
  }

  useEffect(() => {
    if (!channel) return
    
    const loadHistory = async () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000
      const allMessages = []
      let historyPage = await channel.history({ start: twoMinutesAgo, end: Date.now(), direction: "forwards" })

      while (historyPage && historyPage.items.length > 0) {
        allMessages.push(...historyPage.items)
        if (historyPage.hasNext()) {
          const nextPage = await historyPage.next()
          if (nextPage) {
            historyPage = nextPage
          } else {
            break
          }
        } else {
          break
        }
      }

      let tempPlayers = [...initialPlayers]
      let tempScore = { home: 0, away: 0 }
      let tempTimeLeft = GAME_DURATION_SECONDS
      let tempIsGameActive = false
      let tempGameHasStarted = false

      const lastStateMessage = [...allMessages]
        .reverse()
        .find((m) => m.name === "game-status-update" || m.name === "reset")

      let gameStartTime = 0
      
      if (lastStateMessage) {
        if (lastStateMessage.name === "reset") {
          // Game was reset, so we start fresh from this point
          gameStartTime = lastStateMessage.timestamp
        } else if (lastStateMessage.name === "game-status-update") {
          const { isGameActive, timeLeft: historicalTimeLeft } = lastStateMessage.data
          const timeSince = Math.floor((Date.now() - lastStateMessage.timestamp) / 1000)
          const newTimeLeft = historicalTimeLeft - timeSince

          if (newTimeLeft > 0) {
            tempGameHasStarted = true
            tempIsGameActive = isGameActive
            tempTimeLeft = newTimeLeft
            // If this is a game start message (game became active), use it as the start time
            if (isGameActive && historicalTimeLeft === GAME_DURATION_SECONDS) {
              gameStartTime = lastStateMessage.timestamp
            }
          }
        }
      }

      allMessages.forEach((msg) => {
        // Only process messages after the game start time
        if (msg.timestamp < gameStartTime) return
        
        switch (msg.name) {
          case "player-stat-update":
            tempPlayers = tempPlayers.map((p) => (p.id === msg.data.playerId ? { ...p, stats: msg.data.newStats } : p))
            break
          case "score-update":
            tempScore = msg.data
            break
        }
      })

      setPlayers(tempPlayers)
      setScore(tempScore)
      setTimeLeft(tempTimeLeft)
      setIsGameActive(tempIsGameActive)
      setGameHasStarted(tempGameHasStarted)
      setIsHistoryLoaded(true)
    }
    loadHistory()
  }, [channel])


  // Client-side timer with server synchronization
  useEffect(() => {
    if (!isGameActive || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft((prevTime) => {
        // Never let it go below 0
        const newTime = Math.max(0, prevTime - 1)
        
        // If we hit 0, stop the game
        if (newTime === 0) {
          setIsGameActive(false)
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isGameActive, lastServerTimeUpdate, timeLeft]) // Re-sync when server updates

  const handleEvent = (playerId: number, event: keyof Player["stats"]) => {
    if (!isGameActive || !channel) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    const newStats = { ...player.stats, [event]: player.stats[event] + 1 }
    channel.publish("player-stat-update", { playerId, newStats })
    
    // Update score if it's a goal
    if (event === "goals") {
      const newScore = { ...score, home: score.home + 1 }
      channel.publish("score-update", newScore)
    }
  }

  const handleAwayGoal = () => {
    if (!isGameActive || !channel) return
    const newScore = { ...score, away: score.away + 1 }
    channel.publish("score-update", newScore)
  }

  const resetGame = () => channel?.publish("reset", {})
  const startGame = () => channel?.publish("game-status-update", { isGameActive: true, timeLeft: GAME_DURATION_SECONDS })

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Early return if client is not ready
  if (!client) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
        <p className="mt-4 text-lg">Connecting to server...</p>
      </div>
    )
  }

  if (!isHistoryLoaded) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
        <p className="mt-4 text-lg">Syncing with the timeline...</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col p-4 md:p-8 relative">
      <div className="absolute top-4 right-4 z-20">
        <GlobalPresenceIndicator members={presenceData} clientId={client?.auth.clientId} />
      </div>

      {!gameHasStarted && <StartGameModal onStart={startGame} presenceCount={presenceCount} />}

      <header className="text-center mb-6">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500">
          LEGENDS&apos; LEAGUE
        </h1>
        <p className="text-2xl text-cyan-300 font-bold tracking-wide">5-A-SIDE FRENZY</p>
      </header>

      <main className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="flex-grow lg:w-2/3 bg-green-800/30 border-4 border-green-500/50 rounded-xl p-4 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-white/20 rounded-full w-48 h-48" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full border-l-4 border-dashed border-white/20" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
            {players.map((player) => (
              <Card
                key={player.id}
                className="bg-gray-800/80 border-gray-600 text-white backdrop-blur-sm flex flex-col"
              >
                <CardHeader className="flex flex-row items-center gap-4 p-4 min-h-[110px]">
                  <Avatar className="h-16 w-16 border-2 border-yellow-400 flex-shrink-0">
                    <AvatarImage src={player.imageSrc || "/placeholder.svg"} alt={player.name} />
                    <AvatarFallback className="bg-gray-700 text-white">{player.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl text-yellow-300">{player.name}</CardTitle>
                    <p className="text-cyan-400">{player.position}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-2 text-sm flex-grow">
                  <div className="flex items-center gap-2">
                    <Goal className="w-4 h-4 text-green-400" /> Goals: {player.stats.goals}
                  </div>
                  <div className="flex items-center gap-2">
                    <Hand className="w-4 h-4 text-blue-400" /> Assists: {player.stats.assists}
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" /> Saves: {player.stats.saves}
                  </div>
                  <div className="flex items-center gap-2">
                    <RectangleVertical className="w-4 h-4 text-yellow-400" /> Yellows: {player.stats.yellowCards}
                  </div>
                </CardContent>
                <CardFooter className="p-4 grid grid-cols-2 gap-2">
                  {player.actions.map((action) => (
                    <Button
                      key={action.label}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEvent(player.id, action.event)}
                      disabled={!isGameActive}
                    >
                      {action.label}
                    </Button>
                  ))}
                </CardFooter>
              </Card>
            ))}
            <Card className="bg-red-800/80 border-red-600 text-white backdrop-blur-sm flex flex-col">
              <CardHeader className="p-4 min-h-[110px]">
                <CardTitle className="text-xl text-red-300">Inter YerNan</CardTitle>
                <p className="text-gray-300">The Opposition</p>
              </CardHeader>
              <CardContent className="p-4 flex-grow">
                <p>
                  A mysterious team of upstarts. Not much is known about them, other than their questionable fashion
                  sense.
                </p>
              </CardContent>
              <CardFooter className="p-4">
                <Button variant="destructive" className="w-full" onClick={handleAwayGoal} disabled={!isGameActive}>
                  They Scored!
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <div className="lg:w-1/3 flex flex-col gap-6">
          <Card className="bg-gray-800/80 border-gray-600 text-white backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center gap-4">
              <div className="flex items-center justify-around w-full">
                <div className="text-center">
                  <p className="text-lg text-cyan-300">Inter Miami Pensioners</p>
                  <p className="text-6xl font-bold text-yellow-300">{score.home}</p>
                </div>
                <p className="text-6xl font-bold mx-4">:</p>
                <div className="text-center">
                  <p className="text-lg text-red-400">Inter YerNan</p>
                  <p className="text-6xl font-bold text-red-400">{score.away}</p>
                </div>
              </div>
              {gameHasStarted && (
                <>
                  <Separator className="bg-gray-600 my-1" />
                  {!isGameActive && timeLeft <= 0 ? (
                    <div className="text-center space-y-3 py-2">
                      <p className="text-2xl font-bold text-red-500 animate-pulse">FULL TIME!</p>
                      <Button
                        onClick={resetGame}
                        size="lg"
                        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold"
                      >
                        <Play className="mr-2 h-5 w-5" />
                        Start a New Game
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-4 w-full">
                      <div
                        className={cn(
                          "text-4xl font-mono font-bold",
                          timeLeft < 30 && timeLeft > 0 ? "text-red-500 animate-pulse" : "text-white",
                        )}
                      >
                        {formatTime(timeLeft)}
                      </div>
                      <div className="flex-grow" />
                      <Button
                        onClick={resetGame}
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:bg-red-900/50 hover:text-red-300"
                        title="Reset Game"
                      >
                        <span className="sr-only">Reset Game</span>
                        <RefreshCw className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-800/80 border-gray-600 text-white backdrop-blur-sm flex-grow flex flex-col min-h-0">
            <CardHeader className="p-3 py-2 flex-shrink-0">
              <CardTitle className="text-lg text-yellow-300 flex items-center gap-2">
                <Dribbble /> Live Commentary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-0 overflow-hidden">
              <AICommentary />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default GameDashboard;
