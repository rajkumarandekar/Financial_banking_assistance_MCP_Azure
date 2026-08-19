import strawberry

from gql.mutations import Mutation
from gql.queries import Query

schema = strawberry.Schema(query=Query, mutation=Mutation)
