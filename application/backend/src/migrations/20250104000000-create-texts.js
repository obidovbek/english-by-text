'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Texts', {
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
      folderId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'Folders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      uzRaw: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      enRaw: {
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

    await queryInterface.addIndex('Texts', ['userId', 'folderId', 'title'], {
      unique: true,
      name: 'texts_user_folder_title_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Texts', 'texts_user_folder_title_unique');
    await queryInterface.dropTable('Texts');
  },
};
