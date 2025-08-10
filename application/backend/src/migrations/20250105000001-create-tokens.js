'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Tokens', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      sentenceId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Sentences', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      uz: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      en: {
        type: Sequelize.STRING(200),
        allowNull: false,
        defaultValue: '',
      },
      pos: {
        type: Sequelize.STRING(16),
        allowNull: true,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('Tokens', ['sentenceId', 'order'], {
      unique: true,
      name: 'tokens_sentence_order_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Tokens', 'tokens_sentence_order_unique');
    await queryInterface.dropTable('Tokens');
  },
};
