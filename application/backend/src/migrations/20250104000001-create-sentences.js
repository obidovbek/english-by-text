'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Sentences', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      textId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Texts', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      uz: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      en: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('Sentences', ['textId', 'index'], {
      unique: true,
      name: 'sentences_text_index_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Sentences', 'sentences_text_index_unique');
    await queryInterface.dropTable('Sentences');
  },
};
