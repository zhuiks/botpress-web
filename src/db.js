import Promise from 'bluebird'
import moment from 'moment'
import _ from 'lodash'
import { DatabaseHelpers as helpers } from 'botpress'

module.exports = (knex, botfile) => {

  async function getUserInfo(userId) {
    const user = await knex('users').where({ id: userId }).then().get(0).then()
    const name = user && (`${user.first_name} ${user.last_name}`)
    const avatar = (user && user.picture_url) || null

    return {
      fullName: name,
      avatar_url: avatar
    }
  }

  function initialize() {
    if (!knex) {
      throw new Error('you must initialize the database before')
    }

    return helpers(knex).createTableIfNotExists('web_conversations', function (table) {
      table.increments('id').primary()
      table.string('userId')
      table.string('title')
      table.string('description')
      table.string('logo_url')
      table.timestamp('created_on')
      table.timestamp('last_heard_on')
      table.timestamp('last_seen_on')
    })
    .then(function() {
      return helpers(knex).createTableIfNotExists('web_messages', function (table) {
        table.increments('id').primary()
        table.integer('conversationId')
        table.string('userId')
        table.string('message_type')
        table.string('message_text')
        table.string('message_raw')
        table.string('full_name')
        table.string('avatar_url')
        table.timestamp('sent_on')
      })
    })
  }

  async function appendUserMessage(userId, conversationId, { type, text, raw }) {
    const { fullName, avatar_url } = await getUserInfo(userId)

    return knex('web_messages').insert({
      conversationId: conversationId,
      userId: userId,
      full_name: fullName,
      avatar_url,
      message_type: type,
      message_text: text,
      message_raw: raw,
      sent_on: helpers(knex).date.now(),
      last_heard_on: helpers(knex).date.now()
    }).then()
  }

  function appendBotMessage(botName, botAvatar, conversationId, { type, text, raw }) {
    return knex('web_messages').insert({
      conversationId: conversationId,
      userId: null,
      full_name: botName,
      avatar_url: botAvatar,
      message_type: type,
      message_text: text,
      message_raw: raw,
      sent_on: helpers(knex).date.now()
    }).then()
  }

  async function createConversation(userId) {
    const uid = Math.random().toString().substr(2, 6)
    const title = `Conversation ${uid}`
    
    await knex('web_conversations').insert({
      userId,
      created_on: helpers(knex).date.now(),
      title
    })

    const conversation = knex('web_conversations')
    .where({ title, userId })
    .select('id')
    .then().get(0).then()

    return conversation && conversation.id
  }

  function patchConversation(userId, conversationId, title, description, logoUrl) {
    await knex('web_conversations')
    .where({ userId, id: conversationId })
    .update({
      title,
      description,
      logo_url: logoUrl
    }).then()
  }

  function listConversations(userId) {
    return knex('web_conversations')
    .where({ userId })
    .then()
  }

  function getConversation(userId, conversationId, fromId = null) {
    let query = knex('web_messages')
    .where({
      conversationId: conversationId,
      userId: userId
    })

    if (fromId) {
      query = query.andWhere('id', '<', fromId)
    }

    return query.limit(20).then()
  }

  return {
    initialize,
    appendUserMessage,
    appendBotMessage,
    createConversation,
    patchConversation,
    getConversation
  }
}
