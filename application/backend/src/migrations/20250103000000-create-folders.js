'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Folders', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      parentId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'Folders',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
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

    // Unique composite index on (userId, parentId, name)
    await queryInterface.addIndex('Folders', ['userId', 'parentId', 'name'], {
      unique: true,
      name: 'folders_user_parent_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Folders', 'folders_user_parent_name_unique');
    await queryInterface.dropTable('Folders');
  },
};
