'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Vocabulary', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      word: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      translation: {
        type: Sequelize.STRING(400),
        allowNull: false,
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

    await queryInterface.addIndex('Vocabulary', ['userId', 'word'], {
      unique: true,
      name: 'vocabulary_user_word_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Vocabulary', 'vocabulary_user_word_unique');
    await queryInterface.dropTable('Vocabulary');
  },
};
