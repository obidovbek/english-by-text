'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Folders', 'sourceFolderId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Folders', 'sourceOwnerUserId', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addIndex(
      'Folders',
      ['userId', 'parentId', 'sourceFolderId', 'sourceOwnerUserId'],
      {
        name: 'folders_mirror_lookup_idx',
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Folders', 'folders_mirror_lookup_idx');
    await queryInterface.removeColumn('Folders', 'sourceOwnerUserId');
    await queryInterface.removeColumn('Folders', 'sourceFolderId');
  },
};
