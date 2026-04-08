import { z } from 'zod'
import {
  createdGameDtoSchema,
  endGameResultsDtoSchema,
  gameSettingsDtoSchema,
  gameStartedDtoSchema,
  playerDtoSchema,
  roundFinishedDto,
  roundStartedDto,
} from './game'
import { spotifyTrackSchema } from './spotify'

const messageTypeString = 'message'
const errorTypeString = 'messageError'

export const messageSchema = z.discriminatedUnion('$type', [
  z.object({
    $type: z.literal(`${messageTypeString}`),
    type: z.string(),
  }),
  z.object({
    $type: z.literal(`${errorTypeString}`),
    type: z.string(),
    errorMessage: z.string(),
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/createdGameDto`),
    type: z.literal('createdGame'),
    data: createdGameDtoSchema,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/startGameDto`),
    type: z.literal('startGame'),
    data: z.object({
      tracks: z.array(spotifyTrackSchema),
      gameSettings: gameSettingsDtoSchema,
    }),
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/gameStartedDto`),
    type: z.literal('gameStarted'),
    data: gameStartedDtoSchema,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/playerInfoDto`),
    type: z.literal('newPlayer'),
    data: playerDtoSchema,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/playerList`),
    type: z.literal('playerList'),
    data: z.array(playerDtoSchema),
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/roundStartedDto`),
    type: z.literal('nextRound'),
    data: roundStartedDto,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/roundFinishedDto`),
    type: z.literal('nextRound'),
    data: roundFinishedDto,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/endGameResultsDto`),
    type: z.literal('endGameResults'),
    data: endGameResultsDtoSchema,
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/string`),
    type: z.string(),
    data: z.string(),
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/int`),
    type: z.string(),
    data: z.number(),
  }),
  z.object({
    $type: z.literal(`${messageTypeString}/long`),
    type: z.string(),
    data: z.number(),
  }),
])

export type Message = z.infer<typeof messageSchema>
