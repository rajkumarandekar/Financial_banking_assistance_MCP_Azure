import strawberry

from gql.queries import Query
from gql.mutations import Mutation

schema = strawberry.Schema(query=Query, mutation=Mutation)
