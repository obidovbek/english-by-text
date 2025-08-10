import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

declare module 'fastify' {
  interface FastifyInstance {
    sequelize: Sequelize;
    models: {
      User: typeof UserModel;
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

  await sequelize.authenticate();

  fastify.decorate('sequelize', sequelize);
  fastify.decorate('models', { User: UserModel });

  fastify.addHook('onClose', async (instance) => {
    await instance.sequelize.close();
  });
};

export default fp(sequelizePlugin, { name: 'sequelize' });
