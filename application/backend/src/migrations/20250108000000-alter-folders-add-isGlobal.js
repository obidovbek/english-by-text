'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Folders');
    if (!table.isGlobal) {
      await queryInterface.addColumn('Folders', 'isGlobal', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('Folders', 'isGlobal');
    } catch {}
  },
};
