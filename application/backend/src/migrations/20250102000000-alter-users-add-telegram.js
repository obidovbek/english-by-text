'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'telegramId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('Users', 'username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'phone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'languageCode', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'photoUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'photoUrl');
    await queryInterface.removeColumn('Users', 'languageCode');
    await queryInterface.removeColumn('Users', 'phone');
    await queryInterface.removeColumn('Users', 'lastName');
    await queryInterface.removeColumn('Users', 'username');
    await queryInterface.removeColumn('Users', 'telegramId');
  },
};
