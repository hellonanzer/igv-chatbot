'use strict'

const config = require('../config')
const Monitor = require('./monitor')
const commands = require('./commands')
const database = require('./database')
const debug = require('debug')('igv-bot:app')
const ChatService = require('./services/chat')
const TokenService = require('./services/token')
const PersonService = require('./services/person')
const TelegramBot = require('node-telegram-bot-api')
const UserDataService = require('./services/user-data')
const ApplicationService = require('./services/applications')

/**
 * @returns {TelegramBot}
 */
const factory = () => {
  const { repositories, storages } = database.factory()

  const chatService = new ChatService(repositories.chat, storages.chat)
  const tokenService = new TokenService(repositories.token, storages.token)
  const personService = new PersonService(repositories.person, storages.person)

  const applicationService = new ApplicationService(repositories.application, storages.application, personService)
  const userDataService = new UserDataService(config, applicationService, personService, tokenService)

  const services = {
    person: personService,
    application: applicationService,
    chat: chatService,
    userData: userDataService,
    token: tokenService
  }

  const bot = new TelegramBot(config.TELEGRAM_API_TOKEN, {
    polling: {
      autoStart: false
    }
  })

  bot.getMe()
     .then(me => { debug(`Listening on ${me.username}`) })

  const monitor = Monitor.factory(services, bot)

  monitor.start()

//  process.on('unhandledRejection', (reason, p) => { console.log('Unhandled Rejection at:', p, 'reason:', reason.stack); console.log(reason) });// application specific logging, throwing an error, or other logic here });

  bot.on('message', async (msg) => {
    if ('new_chat_members' in msg) {
      const joinedIds = msg.new_chat_members.map(user => user.id)

      const me = await bot.getMe()

      if (!joinedIds.includes(me.id)) {
        return
      }

      return commands.start(msg, bot, services)
                     .catch(console.error)
    }
  })

  bot.onText(/^\/start/, (msg, match) => {
    commands.start(msg, bot, services)
            .catch(console.error)
  })

  bot.onText(/^\/token (.*)/, (msg, match) => {
    commands.token(msg, match, bot, services)
            .catch(console.error)
  })

  bot.onText(/^\/first (\d)/, (msg, match) => {
    commands.first(msg, bot, match[1], PersonService)
            .catch(console.error)
  })

  bot.onText(/^\/last (\d)/, (msg, match) => {
    commands.last(msg, bot, match[1], PersonService)
            .catch(console.error)
  })

  bot.onText(/^\/rand (\d)/, (msg, match) => {
    commands.rand(msg, bot, match[1], PersonService)
            .catch(console.error)
  })

  bot.onText(/^\/help/, (msg, match) => {
    commands.help(msg, bot)
            .catch(console.error)
  })

  bot.on("callback_query", async (callbackQuery) => {
    commands.handle(callbackQuery, bot, services)
            .catch(console.error)
  });

  return bot
}

module.exports = { factory }
