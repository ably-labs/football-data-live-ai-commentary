"use client"

import { useState, useEffect } from "react"
import { useChannel, ChannelProvider, useAbly } from "ably/react"
import type { Types } from "ably"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dribbble,
  Shield,
  Hand,
  RectangleVertical,
  Goal,
  RefreshCw,
  Play,
  AlertTriangle,
  Users,
  Loader2,
  Ghost,
} from "lucide-react"
import { type Player, type Commentary, initialPlayers, commentaryLines } from "@/app/game-data"
import { cn } from "@/lib/utils"

const channelName = "football-frenzy"
const GAME_DURATION_SECONDS = 120

function ApiKeyInstructions() {
  // ... (This component remains unchanged)
  return (
    <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center p-8">
      <Card className="bg-yellow-900/50 border-yellow-600 max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl text-yellow-300 flex items-center justify-center gap-2">
            <AlertTriangle /> Ably API Key Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>To enable real-time features, you need to configure your Ably API key.</p>
          <p>
            1. Sign up for a free account at{" "}
            <a href="https://ably.com" target="_blank" rel="noopener noreferrer" className="underline text-cyan-400">
              ably.com
            </a>
            .
          </p>
          <p>2. Create a new app and copy your API key.</p>
          <p>
            3. Create a file named <code className="bg-gray-700 p-1 rounded">.env.local</code> in your project's root
            directory.
          </p>
          <p>
            4. Add your key to the file like this:
            <pre className="bg-gray-800 p-2 rounded-md mt-2 text-left">
              <code>NEXT_PUBLIC_ABLY_API_KEY="your-ably-api-key"</code>
            </pre>
          </p>
          <p>5. Restart your development server.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function PresenceIndicator({ count }: { count: number }) {
  if (count <= 1) {
    return (
      <p className="text-sm text-gray-400 text-center">
        It's just you here. Why not{" "}
        <a
          href={typeof window !== "undefined" ? window.location.href : "/"}
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
  members?: Types.PresenceMessage[]
  clientId?: string
}) {
  const MAX_AVATARS_SHOWN = 4
  const totalMembers = members.length

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
          href={typeof window !== "undefined" ? window.location.href : "/"}
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
          <CardTitle className="text-2xl text-yellow-300">Welcome to Legends' League!</CardTitle>
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
  const client = useAbly()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [score, setScore] = useState({ home: 0, away: 0 })
  const [commentary, setCommentary] = useState<Commentary[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS)
  const [isGameActive, setIsGameActive] = useState(false)
  const [gameHasStarted, setGameHasStarted] = useState(false)
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false)
  const [presenceData, setPresenceData] = useState<Types.PresenceMessage[]>([])

  const { channel } = useChannel(channelName, (message) => {
    processMessage(message)
  })

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

  const processMessage = (message: any) => {
    switch (message.name) {
      case "player-stat-update":
        setPlayers((prev) =>
          prev.map((p) => (p.id === message.data.playerId ? { ...p, stats: message.data.newStats } : p)),
        )
        break
      case "score-update":
        setScore(message.data)
        break
      case "new-comment":
        setCommentary((prev) => [message.data, ...prev].slice(0, 50))
        break
      case "game-status-update":
        if (message.data.isGameActive) setGameHasStarted(true)
        setIsGameActive(message.data.isGameActive)
        setTimeLeft(message.data.timeLeft)
        break
      case "reset":
        setPlayers(initialPlayers)
        setScore({ home: 0, away: 0 })
        setTimeLeft(GAME_DURATION_SECONDS)
        setIsGameActive(false)
        setGameHasStarted(false)
        setCommentary([])
        break
    }
  }

  useEffect(() => {
    const loadHistory = async () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000
      const allMessages = []
      let historyPage = await channel.history({ start: twoMinutesAgo, end: Date.now(), direction: "forwards" })

      while (historyPage && historyPage.items.length > 0) {
        allMessages.push(...historyPage.items)
        if (historyPage.hasNext()) {
          historyPage = await historyPage.next()
        } else {
          break
        }
      }

      let tempPlayers = [...initialPlayers]
      let tempScore = { home: 0, away: 0 }
      let tempCommentary: Commentary[] = []
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
          case "new-comment":
            tempCommentary = [msg.data, ...tempCommentary]
            break
        }
      })

      setPlayers(tempPlayers)
      setScore(tempScore)
      setCommentary(tempCommentary.slice(0, 50))
      setTimeLeft(tempTimeLeft)
      setIsGameActive(tempIsGameActive)
      setGameHasStarted(tempGameHasStarted)
      setIsHistoryLoaded(true)
    }
    loadHistory()
  }, [channel])

  const publishCommentary = (commentatorName: "Barry Banter" | "Ronnie Roast", text: string) => {
    const newComment: Commentary = {
      commentator: commentatorName,
      text,
      avatar: commentatorName === "Barry Banter" ? "/images/barry-banter.png" : "/images/ronnie-roast.png",
      timestamp: Date.now(),
    }
    channel.publish("new-comment", newComment)
  }

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isGameActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000)
    } else if (isGameActive && timeLeft <= 0) {
      setIsGameActive(false)
      publishCommentary("Barry Banter", "And that's the final whistle, folks! A hard-fought match from the legends.")
      setTimeout(() => {
        publishCommentary(
          "Ronnie Roast",
          `Final score is Inter Miami Pensioners ${score.home}, Inter YerNan ${score.away}. A classic for the ages.`,
        )
      }, 1500)
    }
    return () => clearInterval(timer)
  }, [isGameActive, timeLeft, score.home, score.away])

  const handleEvent = (playerId: number, event: keyof Player["stats"]) => {
    if (!isGameActive) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    const newStats = { ...player.stats, [event]: player.stats[event] + 1 }
    channel.publish("player-stat-update", { playerId, newStats })
    const commentator = Math.random() > 0.5 ? "Barry Banter" : "Ronnie Roast"
    let lines: string[] = []
    let homeGoal = false
    switch (event) {
      case "goals":
        lines = commentaryLines.goal
        const newScore = { ...score, home: score.home + 1 }
        channel.publish("score-update", newScore)
        homeGoal = true
        break
      case "assists":
        lines = commentaryLines.assist
        break
      case "saves":
        lines = commentaryLines.save
        break
      case "yellowCards":
        lines = commentaryLines.yellowCard
        break
    }
    const randomLine = lines[Math.floor(Math.random() * lines.length)].replace("{player}", player.name)
    publishCommentary(commentator, randomLine)
    if (homeGoal) {
      const otherCommentator = commentator === "Barry Banter" ? "Ronnie Roast" : "Barry Banter"
      const reactionLines = commentaryLines.goalReaction
      const randomReaction = reactionLines[Math.floor(Math.random() * reactionLines.length)].replace(
        "{player}",
        player.name,
      )
      setTimeout(() => publishCommentary(otherCommentator, randomReaction), 1500)
    }
  }

  const handleAwayGoal = () => {
    if (!isGameActive) return
    const newScore = { ...score, away: score.away + 1 }
    channel.publish("score-update", newScore)
    publishCommentary("Ronnie Roast", "Oh dear, Inter YerNan have scored. Schmeichel was probably ordering a hotdog.")
    publishCommentary("Barry Banter", "A momentary lapse in concentration for the legends!")
  }

  const resetGame = () => channel.publish("reset", {})
  const startGame = () => channel.publish("game-status-update", { isGameActive: true, timeLeft: GAME_DURATION_SECONDS })

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
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
          LEGENDS' LEAGUE
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
            <CardHeader className="p-4 flex-shrink-0">
              <CardTitle className="text-xl text-yellow-300 flex items-center gap-2">
                <Dribbble /> Live Commentary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-4 space-y-4">
                {commentary.map((c) => (
                  <div key={`${c.timestamp}-${c.commentator}`} className="flex items-start gap-3 animate-fade-in-up">
                    <Avatar className="h-10 w-10 border-2 border-cyan-400 flex-shrink-0">
                      <AvatarImage src={c.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-gray-700 text-white">{c.commentator.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                      <div className="flex justify-between items-baseline">
                        <p
                          className={cn(
                            "font-bold",
                            c.commentator === "Barry Banter" ? "text-cyan-300" : "text-orange-400",
                          )}
                        >
                          {c.commentator}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className="text-sm text-gray-200">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function FiveASideFrenzyPage() {
  if (!process.env.NEXT_PUBLIC_ABLY_API_KEY) {
    return <ApiKeyInstructions />
  }
  return (
    <ChannelProvider channelName={channelName}>
      <GameDashboard />
    </ChannelProvider>
  )
}
