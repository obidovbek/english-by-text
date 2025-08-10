import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  ForeignKey,
} from 'sequelize';

declare module 'fastify' {
  interface FastifyInstance {
    sequelize: Sequelize;
    models: {
      User: typeof UserModel;
      Folder: typeof FolderModel;
    };
  }
}

class UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  declare id: CreationOptional<number>;
  declare telegramId: number;
  declare firstName: string;
  declare lastName: string | null;
  declare username: string | null;
  declare phone: string | null;
  declare languageCode: string | null;
  declare photoUrl: string | null;
}

class FolderModel extends Model<
  InferAttributes<FolderModel>,
  InferCreationAttributes<FolderModel>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<UserModel['id']>;
  declare name: string;
  declare parentId: number | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare parent?: NonAttribute<FolderModel | null>;
  declare children?: NonAttribute<FolderModel[]>;
}

const sequelizePlugin: FastifyPluginAsync = async (fastify) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
  });

  UserModel.init(
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      telegramId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        unique: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      languageCode: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      photoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    { sequelize, modelName: 'User', tableName: 'Users', timestamps: true },
  );

  FolderModel.init(
    {
      id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        set(value: string) {
          // trim on set
          this.setDataValue('name', (value ?? '').trim());
        },
      },
      parentId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    { sequelize, modelName: 'Folder', tableName: 'Folders', timestamps: true },
  );

  // Associations
  FolderModel.belongsTo(UserModel, { foreignKey: 'userId' });
  FolderModel.belongsTo(FolderModel, { as: 'parent', foreignKey: 'parentId' });
  FolderModel.hasMany(FolderModel, { as: 'children', foreignKey: 'parentId' });

  await sequelize.authenticate();

  fastify.decorate('sequelize', sequelize);
  fastify.decorate('models', { User: UserModel, Folder: FolderModel });

  fastify.addHook('onClose', async (instance) => {
    await instance.sequelize.close();
  });
};

export default fp(sequelizePlugin, { name: 'sequelize' });
